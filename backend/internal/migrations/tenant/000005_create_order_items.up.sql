CREATE TABLE IF NOT EXISTS order_items (
    item_id      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id     UUID          NOT NULL REFERENCES orders(order_id),
    batch_id     UUID          NOT NULL REFERENCES batches(batch_id),
    product_name VARCHAR(255)  NOT NULL,
    batch_no     VARCHAR(100)  NOT NULL,
    qty          INTEGER       NOT NULL,
    sale_price   NUMERIC(10,2) NOT NULL,
    gst_rate     NUMERIC(5,2)  NOT NULL,
    cgst_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
    sgst_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
    igst_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
    line_total   NUMERIC(10,2) NOT NULL
);
