-- One product per (name, company), ignoring case and surrounding spaces.
-- Fails (logged as a warning) while duplicates exist; run
-- scripts/merge_duplicate_products.sql on the tenant first.
CREATE UNIQUE INDEX IF NOT EXISTS products_name_company_key
    ON products (lower(trim(name)), lower(trim(company_name)));
