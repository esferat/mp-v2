-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable (0.9/6.3: идемпотентность потребителя — повтор события не шлёт письмо дважды)
CREATE TABLE "InboxMessage"
(
  "messageId"   TEXT         NOT NULL,
  "routingKey"  TEXT         NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InboxMessage_pkey" PRIMARY KEY ("messageId")
);
