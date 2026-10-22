-- Fills the Test Shop tenant with a copy of Sipra Lifeline's data, so the e2e run
-- sees realistic volume (thousands of bills, hundreds of products, near-duplicates).
-- Runs ONLY against the throwaway local database restored by run.sh.
DO $$
DECLARE
  c record;
  src text := 'tenant_78c1b386';
  dst text := 'tenant_16c19b84';
  t text;
  cols text;
BEGIN
  -- The shared unique index rejects Sipra's near-duplicate products; those are
  -- part of what we want to test against.
  EXECUTE format('DROP INDEX IF EXISTS %I.products_name_company_norm_key', dst);

  EXECUTE format('TRUNCATE %I.order_items, %I.orders, %I.stock_adjustments, %I.batches, %I.products, %I.distributors, %I.customers CASCADE',
                 dst, dst, dst, dst, dst, dst, dst);

  -- The two tenants were created at different times, so some columns are narrower
  -- here than in Sipra (e.g. distributors.phone). Widen them to fit the copy.
  FOR c IN
    SELECT d.table_name, d.column_name
    FROM information_schema.columns s
    JOIN information_schema.columns d
      ON d.table_schema = dst AND d.table_name = s.table_name AND d.column_name = s.column_name
    WHERE s.table_schema = src AND d.data_type = 'character varying'
      AND (s.data_type = 'text' OR s.character_maximum_length > d.character_maximum_length)
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE text', dst, c.table_name, c.column_name);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['distributors','products','batches','customers','orders','order_items','stock_adjustments'] LOOP
    SELECT string_agg(quote_ident(s.column_name), ', ') INTO cols
    FROM information_schema.columns s
    JOIN information_schema.columns d
      ON d.table_schema = dst AND d.table_name = t AND d.column_name = s.column_name
    WHERE s.table_schema = src AND s.table_name = t;
    EXECUTE format('INSERT INTO %I.%I (%s) SELECT %s FROM %I.%I', dst, t, cols, cols, src, t);
  END LOOP;
END $$;

-- One batch that is expired but still has stock, to exercise "Hide expired" (dummy data only).
UPDATE tenant_16c19b84.batches SET expiry_date = current_date - 30
WHERE batch_id = (SELECT batch_id FROM tenant_16c19b84.batches
                  WHERE purchase_qty - sold_qty >= 4 AND expiry_date > current_date + 200 ORDER BY batch_id LIMIT 1);
