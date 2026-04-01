CREATE TABLE IF NOT EXISTS customers (
    customer_id UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    phone       CHAR(10)     NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    age         INTEGER,
    visit_count INTEGER      NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
