#!/usr/bin/env node
/**
 * Интеграционная проверка AC задачи 0.9 против живого окружения:
 *
 *   событие пишется в outbox → рестарт брокера → событие доставляется
 *   в очередь РОВНО ОДИН РАЗ (durable queue + persistent message).
 *
 * Проверяет два AC сразу:
 *   - «при падении между commit и публикацией событие не теряется» — строка
 *     PENDING лежала в БД, релеи опубликовали её после переподключения;
 *   - «рестарт брокера → событие доставлено ровно один раз».
 *
 * Запуск (стек поднят, catalog работает):
 *   pnpm --filter @mp/catalog e2e:outbox
 */
import amqp from 'amqplib';
import pg from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://svc_catalog:svc_catalog_pw@localhost:5432/db_catalog';
const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';
const ROUTING_KEY = 'demo.delivery.v1';
const EVENT_ID = `e2e-outbox-${Date.now()}`;
const QUEUE = 'e2e.outbox.check';

const fail = (message) => {
  console.error(`[outbox-check] FAIL: ${message}`);
  process.exit(1);
};
const ok = (message) => console.log(`[outbox-check] ok: ${message}`);

// 1. Пишем событие в outbox так же, как это делает сервис (статус PENDING)
const pool = new pg.Client({ connectionString: DATABASE_URL });
await pool.connect();
await pool.query(
  `INSERT INTO "OutboxMessage" (id, "routingKey", payload, status, attempts, "nextAttemptAt", "createdAt")
   VALUES ($1, $2, $3, 'PENDING', 0, NOW(), NOW())`,
  [
    EVENT_ID,
    ROUTING_KEY,
    JSON.stringify({
      eventId: EVENT_ID,
      occurredAt: new Date().toISOString(),
      payload: { demo: true },
    }),
  ],
);
ok(`событие ${EVENT_ID} записано в outbox (PENDING)`);

// 2. Постоянная очередь на demo-маршрут (durable — переживёт рестарт брокера)
const firstConnection = await amqp.connect(RABBITMQ_URL);
const firstChannel = await firstConnection.createChannel();
await firstChannel.assertQueue(QUEUE, { durable: true });
await firstChannel.bindQueue(QUEUE, 'medical.events', ROUTING_KEY);
await firstChannel.close();
await firstConnection.close();
ok('очередь e2e.outbox.check объявлена и подписана на medical.events');

// 3. Рестарт брокера: событие ещё НЕ опубликовано (или опубликовано, но durable)
const { execSync } = await import('node:child_process');
console.log('[outbox-check] рестарт контейнера rabbitmq…');
execSync('docker restart mp-v2-rabbitmq-1', { stdio: 'ignore' });

// Ждём здорового брокера
for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    const probe = await amqp.connect(RABBITMQ_URL);
    await probe.close();
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (attempt === 59) fail('брокер не поднялся после рестарта');
  }
}
ok('брокер снова доступен после рестарта');

// 4. Релеи outbox сервиса должны дожать PENDING-событие; слушаем и считаем
const connection = await amqp.connect(RABBITMQ_URL);
const channel = await connection.createChannel();
await channel.prefetch(10);

const received = [];
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('событие не доставлено за 90 с')), 90_000);

  void channel
    .consume(
      QUEUE,
      (message) => {
        if (!message) return;
        const body = JSON.parse(message.content.toString('utf8'));
        received.push(body.eventId ?? '(нет eventId)');
        channel.ack(message);
      },
      { noAck: false },
    )
    .then(() => {
      // После первой доставки ждём ещё 10 с «тишины» на случай дубля
      const poll = setInterval(() => {
        if (received.includes(EVENT_ID)) {
          setTimeout(() => {
            clearInterval(poll);
            clearTimeout(timer);
            resolve();
          }, 10_000);
        }
      }, 1000);
    })
    .catch(reject);
});

await channel.close();
await connection.close();

// 5. Итог: доставлено ровно один раз + строка помечена PUBLISHED
const occurrences = received.filter((id) => id === EVENT_ID).length;
if (occurrences !== 1) {
  fail(`событие доставлено ${occurrences} раз(а), ожидалось ровно 1`);
}
ok(`событие доставлено ровно один раз (${occurrences})`);

const row = await pool.query(`SELECT status, attempts FROM "OutboxMessage" WHERE id = $1`, [
  EVENT_ID,
]);
await pool.end();
const [record] = row.rows;
if (record?.status !== 'PUBLISHED') {
  fail(`статус outbox = ${record?.status}, ожидалось PUBLISHED`);
}
ok(`outbox: status=${record.status}, attempts=${record.attempts}`);

console.log('[outbox-check] ВСЕ ПРОВЕРКИ 0.9 ПРОЙДЕНЫ');
