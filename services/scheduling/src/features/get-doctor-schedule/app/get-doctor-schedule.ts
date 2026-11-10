import type { DoctorSchedule } from '@mp/contracts';
import { isActiveCopy, type ScheduleCopyRepository } from '../../../entities/schedule-copy';
import { NotFoundError } from '../../../shared/model';

/**
 * Расписание врача для диалога переноса (10.3 UI): сетка времени и
 * рабочие дни из копии (5.1). Врач неактивен/нет копии → 404.
 */
export async function getDoctorSchedule(
  copies: ScheduleCopyRepository,
  doctorId: string,
): Promise<DoctorSchedule> {
  const copy = await copies.findById(doctorId);
  if (!isActiveCopy(copy)) {
    throw new NotFoundError('Врач не найден или не принимает запись');
  }
  return {
    startTime: copy.startTime,
    endTime: copy.endTime,
    durationMinutes: copy.durationMinutes,
    workDays: copy.workDays,
  };
}
