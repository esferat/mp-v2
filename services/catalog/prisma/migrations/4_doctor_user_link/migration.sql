-- 9.1: связка user ↔ doctor (Keycloak sub в карточке врача, как Patient.userId)
ALTER TABLE "Doctor"
  ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_userId_key" ON "Doctor" ("userId");
