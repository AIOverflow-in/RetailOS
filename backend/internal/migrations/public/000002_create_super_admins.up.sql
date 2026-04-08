CREATE TABLE IF NOT EXISTS super_admins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(100) NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    hashed_password TEXT         NOT NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS super_admin_otp (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id   UUID         NOT NULL REFERENCES super_admins(id) ON DELETE CASCADE,
    otp_code   VARCHAR(6)   NOT NULL,
    expires_at TIMESTAMPTZ  NOT NULL,
    used       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_super_admin_otp_admin_id ON super_admin_otp(admin_id);
CREATE INDEX idx_super_admin_otp_expires  ON super_admin_otp(expires_at);
