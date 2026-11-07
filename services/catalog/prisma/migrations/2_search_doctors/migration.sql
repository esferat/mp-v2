-- Расширение для триграммного поиска по ФИО (3.1: ILIKE + pg_trgm).
-- pg_trgm — trusted extension: устанавливается владельцем БД (svc_catalog).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Триграммный GIN-индекс: ускоряет ILIKE '%подстрока%' по «Фамилия Имя».
-- EXPLAIN на нём проверяется в этапном аудите (P-R, R.4).
CREATE INDEX IF NOT EXISTS "Doctor_fullname_trgm_idx"
  ON "Doctor" USING GIN (("lastName" || ' ' || "firstName") gin_trgm_ops);
