import type { SlotList, SlotsQuery } from '@mp/contracts';
import {
  type DoctorCatalogPort,
  importCopiesFromCatalog,
  isActiveCopy,
  type ScheduleCopyRepository,
} from '../../../entities/schedule-copy';
import type { AppointmentRepository } from '../../../entities/appointment';
import { busyKey, computeSlots, type SlotWindow } from '../../../entities/slots';
import { ValidationError } from '../../../shared/model';

/** Максимальный период расчёта слотов (защита от чрезмерного расчёта). */
const MAX_RANGE_DAYS = 92;

export interface GetSpecSlotsDeps {
  copies: ScheduleCopyRepository;
  appointments: AppointmentRepository;
  /** Порт catalog — для fallback'а при расхождении read-model (3.5). */
  catalog?: DoctorCatalogPort;
  log?: { warn(payload: Record<string, unknown>, message: string): void };
}

/** Свободные слоты по специализации (5.2): копии расписаний минус занятые. */
export async function getSpecSlots(deps: GetSpecSlotsDeps, query: SlotsQuery): Promise<SlotList> {
  const from = new Date(`${query.from}T00:00:00.000Z`).getTime();
  const to = new Date(`${query.to}T00:00:00.000Z`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) {
    throw new ValidationError('Некорректный период дат', 'from');
  }
  if ((to - from) / 86_400_000 > MAX_RANGE_DAYS) {
    throw new ValidationError('Период слотов не длиннее трёх месяцев', 'to');
  }

  let copies = await deps.copies.findForSpecialization(query.specId);

  // Fallback (3.5): специализация без копий — расхождение read-model,
  // синхронный импорт из catalog с логом предупреждения
  if (copies.length === 0 && deps.catalog) {
    deps.log?.warn(
      { specId: query.specId },
      'расхождение read-model: копий нет, синхронный импорт из catalog',
    );
    await importCopiesFromCatalog(deps.copies, deps.catalog);
    copies = await deps.copies.findForSpecialization(query.specId);
  }

  const windows: SlotWindow[] = copies.filter(isActiveCopy).map((copy) => ({
    doctorId: copy.doctorId,
    doctorName: [copy.lastName, copy.firstName, copy.middleName ?? '']
      .filter((part) => part.length > 0)
      .join(' '),
    startTime: copy.startTime,
    endTime: copy.endTime,
    durationMinutes: copy.durationMinutes,
    workDays: copy.workDays,
  }));
  if (windows.length === 0) return [];

  const busyRows = await deps.appointments.findBusy(
    windows.map((window) => window.doctorId),
    query.from,
    query.to,
  );
  const busy = new Set(busyRows.map((row) => busyKey(row.doctorId, row.localDate, row.startTime)));

  const base = {
    windows,
    from: query.from,
    to: query.to,
    ...(query.startTime ? { startTime: query.startTime } : {}),
    ...(query.endTime ? { endTime: query.endTime } : {}),
  };

  // Без includeBusy — только свободные (перенос записи, e2e). С параметром —
  // все слоты окон с пометкой available: сетка записи «зелёные/серые» (6/шаг 3).
  const slots = !query.includeBusy
    ? computeSlots({ ...base, busy }).map((slot) => ({ ...slot, available: true }))
    : computeSlots({ ...base, busy: new Set() }).map((slot) => ({
        ...slot,
        available: !busy.has(busyKey(slot.doctorId, slot.localDate, slot.start)),
      }));

  if (slots.length === 0 || !deps.catalog) return slots;

  // Аватары врачей в плитках wizard'а: photoUrl — presigned из catalog
  // (1 HTTP-вызов; поле опционально — без catalog слоты приходят без него)
  try {
    const doctors = await deps.catalog.listDoctors();
    const photoByDoctor = new Map(doctors.map((doctor) => [doctor.id, doctor.photoUrl] as const));
    return slots.map((slot) => {
      const photoUrl = photoByDoctor.get(slot.doctorId);
      return photoUrl ? { ...slot, doctorPhotoUrl: photoUrl } : slot;
    });
  } catch {
    // каталог недоступен — показываем инициалы, слоты не теряем
    return slots;
  }
}
