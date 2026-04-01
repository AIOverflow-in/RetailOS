CREATE TABLE IF NOT EXISTS products (
    product_id   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    sku          VARCHAR(100) UNIQUE,
    hsn_code     VARCHAR(20),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
