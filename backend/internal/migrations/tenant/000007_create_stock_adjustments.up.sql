CREATE TABLE IF NOT EXISTS stock_adjustments (
    adjustment_id UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id      UUID         NOT NULL REFERENCES batches(batch_id),
    qty_change    INTEGER      NOT NULL,
    reason        VARCHAR(50)  NOT NULL,
    notes         TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
