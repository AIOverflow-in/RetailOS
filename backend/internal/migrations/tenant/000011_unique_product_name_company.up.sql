-- One product per (name, company). The key ignores case, spaces and punctuation
-- ("+" vs "&", "EL-Nico-10" vs "EL-Nico 10") but keeps punctuation between
-- digits as "d", so "12.5 mcg" vs "125 mcg" and "50/1000" vs "501000" stay different. Non-Latin
-- letters are kept, so names in other scripts don't collapse to an empty key.
--
-- Runs as one implicit transaction on every startup: while near-duplicates exist
-- the CREATE fails (logged as a warning), the DROP never runs, and the exact-name
-- index created by scripts/merge_duplicate_products.sql stays in force.
CREATE UNIQUE INDEX IF NOT EXISTS products_name_company_norm_key ON products (
    regexp_replace(regexp_replace(lower(name), '([0-9])[[:punct:]]+([0-9])', '\1d\2', 'g'), '[[:space:][:punct:]]', '', 'g'),
    regexp_replace(regexp_replace(lower(company_name), '([0-9])[[:punct:]]+([0-9])', '\1d\2', 'g'), '[[:space:][:punct:]]', '', 'g')
);
DROP INDEX IF EXISTS products_name_company_key;
