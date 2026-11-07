-- Оптимизация индексов врачей (аудит: индекс-выражение не покрывал OR-записку).
--
-- 1) Старый GIN на конкатенации ("lastName" || ' ' || "firstName") не
--    использовался запросом поиска: WHERE lastName ILIKE OR firstName ILIKE
--    OR middleName ILIKE обращается к отдельным колонкам (middleName не
--    покрыт вовсе) — был seq scan.
-- 2) Вместо него — по GIN-индексу на каждую искомую колонку: Postgres
--    собирает BitmapOr трёх индексов.
-- 3) Отдельно — составной индекс под основной список: WHERE status = ...
--    ORDER BY lastName, firstName (старые [specializationId, status] и
--    [lastName, firstName] не покрывали эту пару).

DROP INDEX IF EXISTS "Doctor_fullname_trgm_idx";

CREATE INDEX IF NOT EXISTS "Doctor_lastName_trgm_idx"
  ON "Doctor" USING GIN ("lastName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Doctor_firstName_trgm_idx"
  ON "Doctor" USING GIN ("firstName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Doctor_middleName_trgm_idx"
  ON "Doctor" USING GIN ("middleName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Doctor_status_lastName_firstName_idx"
  ON "Doctor" ("status", "lastName", "firstName");
