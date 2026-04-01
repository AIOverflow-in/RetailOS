CREATE TABLE IF NOT EXISTS batches (
    batch_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id    UUID         NOT NULL REFERENCES products(product_id),
    batch_no      VARCHAR(100) NOT NULL,
    expiry_date   DATE         NOT NULL,
    mrp           NUMERIC(10,2) NOT NULL,
    buying_price  NUMERIC(10,2) NOT NULL,
    selling_price NUMERIC(10,2) NOT NULL,
    purchase_qty  INTEGER      NOT NULL,
    sold_qty      INTEGER      NOT NULL DEFAULT 0,
    box_no        VARCHAR(50),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, batch_no),
    CHECK (buying_price < selling_price AND selling_price < mrp)
);
