-- Optional postal address, printed on the bill when present. Nullable: existing
-- customers have none.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
