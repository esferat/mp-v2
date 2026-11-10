-- 9.1/9.2: привязка sub → doctorId в копии расписания (без HTTP при проверке врача)
ALTER TABLE "DoctorScheduleCopy"
  ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "DoctorScheduleCopy_userId_idx" ON "DoctorScheduleCopy" ("userId");
