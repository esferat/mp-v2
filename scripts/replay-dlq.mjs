// Replay DLQ (6.3): «перекинуть сообщение из DLQ в основную очередь».
//
// Playbook (AC 6.3): отравленное сообщение → DLQ → починка → replay → обработано.
// Скрипт перекладывает сообщения из `<queue>.dlq` обратно в `<queue>` напрямую
// (sendToQueue), сохраняя тело и properties — eventId в конверте не меняется,
// поэтому inbox потребителя отсекает дубли при повторном проходе (at-least-once).
//
// Запуск (стенд поднят):
//   node scripts/replay-dlq.mjs q.notification.appointment-submitted
//   node scripts/replay-dlq.mjs q.notification.appointment-submitted --dry-run
//   node scripts/replay-dlq.mjs q.notification.appointment-submitted --limit 10
//
// Окружение: RABBITMQ_URL (дефолт amqp://guest:guest@localhost:5672).
import { connect } from 'amqplib';

const [, , queueArg, ...flags] = process.argv;
const dryRun = flags.includes('--dry-run');
const limitIndex = flags.indexOf('--limit');
const limit = limitIndex >= 0 ? Number(flags[limitIndex + 1]) : Number.POSITIVE_INFINITY;

if (!queueArg) {
  console.error('Usage: node scripts/replay-dlq.mjs <queue> [--dry-run] [--limit N]');
  process.exit(2);
}

const dlq = `${queueArg}.dlq`;
const url = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';

function fail(message, error) {
  console.error(`FAIL: ${message}`, error ? String(error.message ?? error) : '');
  process.exit(1);
}

const connection = await connect(url);
try {
  const channel = await connection.createChannel();

  // Глубина DLQ до операции (вывод для отчёта/AC «replay отработан»).
  const before = await channel.checkQueue(dlq);
  console.log(`DLQ ${dlq}: ${before.messageCount} сообщений`);
  if (before.messageCount === 0) {
    console.log('Пусто — replay нечего выполнять.');
    process.exit(0);
  }

  let moved = 0;
  let failed = 0;
  // Защита от цикла: яд, который после обработки снова падает в DLQ, вернётся
  // сюда же — без контроля скрипт будет качать его бесконечно. Повтор
  // содержимого сообщения → стоп (ничего не теряется: сообщение остаётся в DLQ).
  const seen = new Set();

  for (;;) {
    if (moved >= limit) break;
    // noAck=false: сообщение подтверждается только после успешного возврата
    // в основную очередь — при сбое ничего не теряется (остаётся в DLQ).
    const message = await channel.get(dlq, { noAck: false });
    if (!message) break;

    const fingerprint = message.content.toString('utf8');
    if (seen.has(fingerprint)) {
      channel.nack(message, false, true);
      fail(
        `цикл replay: сообщение уже перекачивалось и снова в DLQ (яд не лечится повтором) — разобрать вручную`,
      );
    }

    if (dryRun) {
      console.log(`[dry-run] вернул бы в ${queueArg}: ${message.content.length} байт`);
      channel.nack(message, false, true); // обратно в DLQ, без изменений
      moved += 1;
      continue;
    }

    try {
      const { fields, properties, content } = message;
      // Прямая доставка в основную очередь: routing key DLQ-сообщения уже
      // подменён при dead-letter, поэтому минуем exchange.
      await channel.sendToQueue(queueArg, content, {
        persistent: true,
        ...(properties.contentType ? { contentType: properties.contentType } : {}),
        ...(properties.messageId ? { messageId: properties.messageId } : {}),
        ...(properties.headers ? { headers: properties.headers } : {}),
      });
      channel.ack(message);
      seen.add(fingerprint); // учтено: повтор содержимого на следующих итерациях = цикл
      moved += 1;
      console.log(`вернул в ${queueArg}: ${content.length} байт (rk=${fields.routingKey})`);
    } catch (error) {
      failed += 1;
      channel.nack(message, false, true); // ничего не потеряно — сообщение в DLQ
      fail(`не удалось вернуть сообщение в ${queueArg}`, error);
    }
  }

  const after = await channel.checkQueue(queueArg);
  console.log(
    dryRun
      ? `Итог (dry-run): просмотрено ${moved}, DLQ не изменён`
      : `Итог: перекинуто ${moved}, ошибок ${failed}; ${queueArg} = ${after.messageCount} сообщений`,
  );
} finally {
  await connection.close().catch(() => undefined);
}
