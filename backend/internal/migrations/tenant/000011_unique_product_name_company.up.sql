-- One product per (name, company). The key ignores case, spaces and punctuation
-- ("+" vs "&", "EL-Nico-10" vs "EL-Nico 10") except where punctuation carries meaning:
--   * a "+" stuck to the end of a word is kept, one marker per "+" ("Gold+" vs "Gold",
--     "SPF 50+" vs "SPF 50", "PA+++" vs "PA++++"); a spaced " + " connector is ignored
--   * punctuation between digits is kept ("12.5 mcg" vs "125 mcg", "50/1000" vs "501000")
-- Non-Latin letters are kept, so names in other scripts don't collapse to an empty key.
-- COLLATE "C" pins what [[:punct:]] / [[:space:]] mean to ASCII, so the key is the same
-- on every server locale (prod is C.UTF-8; a Mac's en_US.UTF-8 doesn't treat "+" as punct).
-- FindProductByNameCompany (queries/products.sql) must use the same expression.
--
-- Runs as one implicit transaction on every startup: while near-duplicates exist
-- the CREATE fails (logged as a warning), the DROP never runs, and the exact-name
-- index created by scripts/merge_duplicate_products.sql stays in force.
CREATE UNIQUE INDEX IF NOT EXISTS products_name_company_norm_key ON products (
    regexp_replace(regexp_replace(regexp_replace(lower(name) COLLATE "C", '(?<=[^[:space:]])\+(?=\+*([[:space:]]|$))', 'p', 'g'), '([0-9])[[:punct:]]+([0-9])', '\1d\2', 'g'), '[[:space:][:punct:]]', '', 'g'),
    regexp_replace(regexp_replace(regexp_replace(lower(company_name) COLLATE "C", '(?<=[^[:space:]])\+(?=\+*([[:space:]]|$))', 'p', 'g'), '([0-9])[[:punct:]]+([0-9])', '\1d\2', 'g'), '[[:space:][:punct:]]', '', 'g')
);
DROP INDEX IF EXISTS products_name_company_key;
