-- 10.3 (Этап 2.1): журнал переносов записей
CREATE TABLE "AppointmentRescheduleLog"
(
  "id"             TEXT         NOT NULL,
  "appointmentId"  TEXT         NOT NULL,
  "previousStatus" TEXT         NOT NULL,
  "oldDoctorId"    TEXT         NOT NULL,
  "oldLocalDate"   TIMESTAMP(3) NOT NULL,
  "oldStart"       TEXT         NOT NULL,
  "oldEnd"         TEXT         NOT NULL,
  "newDoctorId"    TEXT         NOT NULL,
  "newLocalDate"   TIMESTAMP(3) NOT NULL,
  "newStart"       TEXT         NOT NULL,
  "newEnd"         TEXT         NOT NULL,
  "changedBy"      TEXT         NOT NULL,
  "reason"         TEXT,
  "changedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppointmentRescheduleLog_pkey" PRIMARY KEY ("id")
);

-- Журнал: история переносов конкретной записи (просмотр/аудит, 10.3)
CREATE INDEX "AppointmentRescheduleLog_appointmentId_changedAt_idx" ON "AppointmentRescheduleLog" ("appointmentId", "changedAt");
