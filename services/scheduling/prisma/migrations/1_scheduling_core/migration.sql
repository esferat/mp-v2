-- 5.1/5.3: read-model расписаний и записи на приём
CREATE TABLE "DoctorScheduleCopy" (
    "doctorId" TEXT NOT NULL,
    "specializationId" TEXT NOT NULL,
    "specializationName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "workDays" INTEGER[],
    "sourceAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorScheduleCopy_pkey" PRIMARY KEY ("doctorId")
);

-- CreateIndex
CREATE INDEX "DoctorScheduleCopy_specializationId_status_idx" ON "DoctorScheduleCopy"("specializationId", "status");

CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "doctorName" TEXT NOT NULL,
    "specializationId" TEXT NOT NULL,
    "specializationName" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "localDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Appointment_localDate_status_idx" ON "Appointment"("localDate", "status");

-- CreateIndex
CREATE INDEX "Appointment_patientId_localDate_idx" ON "Appointment"("patientId", "localDate");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_localDate_startTime_idx" ON "Appointment"("doctorId", "localDate", "startTime");

-- CreateIndex
CREATE INDEX "Appointment_specializationId_localDate_idx" ON "Appointment"("specializationId", "localDate");

-- Атомарная защита от двойного бронирования (5.3 AC): частичный уникальный
-- индекс — слот можно перебронировать после CANCELLED (канон §1).
CREATE UNIQUE INDEX "Appointment_doctorId_localDate_startTime_key"
  ON "Appointment"("doctorId", "localDate", "startTime")
  WHERE "status" <> 'CANCELLED';
