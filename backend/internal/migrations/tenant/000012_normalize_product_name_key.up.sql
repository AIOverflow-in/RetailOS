-- Widen product uniqueness to ignore punctuation and spacing ("+" vs "&", "EL-Nico-10" vs
-- "EL-Nico 10"). Runs as one implicit transaction: if near-duplicates still exist the
-- CREATE fails, the DROP never runs, and the 000011 index stays in force.
CREATE UNIQUE INDEX IF NOT EXISTS products_name_company_norm_key
    ON products (regexp_replace(lower(name), '[^a-z0-9]', '', 'g'),
                 regexp_replace(lower(company_name), '[^a-z0-9]', '', 'g'));
DROP INDEX IF EXISTS products_name_company_key;
