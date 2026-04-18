-- Create distributors table
CREATE TABLE IF NOT EXISTS distributors (
    distributor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(255) NOT NULL,
    phone          TEXT,
    address        TEXT,
    email          VARCHAR(255),
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add distributor_id FK and purchase_invoice_no to batches
ALTER TABLE batches
    ADD COLUMN IF NOT EXISTS distributor_id      UUID REFERENCES distributors(distributor_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS purchase_invoice_no VARCHAR(100);

-- Deduplicate: re-link batches pointing at a duplicate to the oldest record per name
UPDATE batches b
SET distributor_id = keeper.distributor_id
FROM distributors dup
JOIN (
    SELECT DISTINCT ON (name) distributor_id, name
    FROM distributors ORDER BY name, created_at ASC
) keeper ON keeper.name = dup.name
WHERE b.distributor_id = dup.distributor_id
  AND b.distributor_id != keeper.distributor_id;

-- Deduplicate: delete extra rows, keep the oldest per name
DELETE FROM distributors
WHERE distributor_id NOT IN (
    SELECT DISTINCT ON (name) distributor_id
    FROM distributors ORDER BY name, created_at ASC
);

-- Auto-migrate: insert distinct distributors from existing JSONB data (only if table is empty)
INSERT INTO distributors (name, phone, address)
SELECT DISTINCT ON (distributor_details->>'name')
    distributor_details->>'name',
    distributor_details->>'phone',
    distributor_details->>'location'
FROM batches
WHERE distributor_details IS NOT NULL
  AND (distributor_details->>'name') IS NOT NULL
  AND (distributor_details->>'name') <> ''
  AND NOT EXISTS (SELECT 1 FROM distributors);

-- Link existing batches to newly created distributor records
UPDATE batches b
SET    distributor_id      = d.distributor_id,
       purchase_invoice_no = b.distributor_details->>'invoice_no'
FROM   distributors d
WHERE  (b.distributor_details->>'name') = d.name
  AND  b.distributor_details IS NOT NULL;
