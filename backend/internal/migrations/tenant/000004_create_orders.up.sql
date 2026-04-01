CREATE TABLE IF NOT EXISTS orders (
    order_id     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50)   NOT NULL UNIQUE,
    customer_id  UUID          REFERENCES customers(customer_id),
    cgst_total   NUMERIC(10,2) NOT NULL DEFAULT 0,
    sgst_total   NUMERIC(10,2) NOT NULL DEFAULT 0,
    igst_total   NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(10,2) NOT NULL,
    status       VARCHAR(20)   NOT NULL DEFAULT 'active',
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
