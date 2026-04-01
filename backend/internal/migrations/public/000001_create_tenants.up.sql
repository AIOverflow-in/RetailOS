CREATE TABLE IF NOT EXISTS tenants (
    tenant_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_name       VARCHAR(255) NOT NULL,
    schema_name     VARCHAR(100) NOT NULL UNIQUE,
    order_prefix    VARCHAR(20)  NOT NULL DEFAULT 'INV',
    username        VARCHAR(100) NOT NULL UNIQUE,
    hashed_password TEXT         NOT NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
