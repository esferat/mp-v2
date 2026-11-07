import { Inject, Injectable, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { RoutingKeys } from '@mp/contracts';
import {
  InboxService,
  LOGGER,
  RabbitService,
  type ConsumedEvent,
  type Logger,
} from '@mp/service-kit';
import {
  importCopiesFromCatalog,
  SCHEDULE_COPY_REPOSITORY,
  type ScheduleCopyRepository,
} from '../../entities/schedule-copy';
import { CATALOG_CLIENT, type CatalogHttpClient } from '../../shared/api';
import { applyDoctorEvent } from './app/apply-doctor-event';

/**
 * Потребитель doctor.* и bootstrap копий расписаний (5.1/3.5):
 *
 * - очередь scheduling.schedule-copy подписана на doctor.created/updated.v1;
 *   идемпотентность обработки — InboxService.runOnce по eventId, идемпотентность
 *   самих данных — условный апсерт по occurredAt (AC 3.5: повтор не портит данные);
 * - при пустом read-model при старте выполняется импорт из catalog (bootstrap),
 *   при расхождении (специализация без копий) слоты дёргают тот же импорт.
 *
 * InboxModule подключается глобально из app/app.module.ts (forRootAsync).
 */
@Injectable()
export class ScheduleCopySync implements OnApplicationBootstrap {
  constructor(
    @Inject(SCHEDULE_COPY_REPOSITORY)
    private readonly repository: ScheduleCopyRepository,
    private readonly inbox: InboxService,
    private readonly rabbit: RabbitService,
    @Inject(CATALOG_CLIENT)
    private readonly catalog: CatalogHttpClient,
    @Inject(LOGGER)
    private readonly log: Logger,
  ) {}

  onApplicationBootstrap(): void {
    this.rabbit.subscribe({
      queue: 'scheduling.schedule-copy',
      bindings: [RoutingKeys.DoctorCreated, RoutingKeys.DoctorUpdated],
      handler: (event) => this.handle(event),
    });

    void this.bootstrap().catch((error: unknown) => {
      // Сбой bootstrap не должен ронять сервис: fallback отработают слоты (3.5)
      this.log.warn({ err: error }, 'bootstrap копий расписаний не выполнен');
    });
  }

  private async handle(event: ConsumedEvent): Promise<void> {
    const body = event.body as { eventId?: string };
    if (!body?.eventId) {
      throw new Error('у события нет eventId (конверт повреждён) — в DLQ');
    }
    await this.inbox.runOnce(body.eventId, event.routingKey, () =>
      applyDoctorEvent(this.repository, event),
    );
  }

  private async bootstrap(): Promise<void> {
    const count = await this.repository.count();
    if (count > 0) {
      this.log.info({ copies: count }, 'копии расписаний загружены');
      return;
    }
    const { imported } = await importCopiesFromCatalog(this.repository, this.catalog);
    this.log.info({ imported }, 'read-model расписаний пуст: выполнен импорт из catalog (5.1)');
  }
}

/** Публичный API слайса (fsd.md S5): подписка + bootstrap (5.1). */
@Module({
  providers: [ScheduleCopySync],
  exports: [ScheduleCopySync],
})
export class ScheduleCopySyncModule {}
