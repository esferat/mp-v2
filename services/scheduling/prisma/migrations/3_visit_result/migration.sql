-- 9.2: результат приёма (заключение/рекомендации) для COMPLETED-записей
CREATE TABLE "VisitResult" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "conclusion" TEXT NOT NULL,
    "recommendations" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisitResult_appointmentId_key" ON "VisitResult"("appointmentId");

-- CreateIndex
CREATE INDEX "VisitResult_createdBy_idx" ON "VisitResult"("createdBy");

-- AddForeignKey
ALTER TABLE "VisitResult" ADD CONSTRAINT "VisitResult_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
