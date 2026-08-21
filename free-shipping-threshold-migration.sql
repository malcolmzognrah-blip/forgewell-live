-- Adds the admin-configurable free-shipping dollar threshold ("orders
-- over $X ship free") as a new site_content row, same key/body table
-- already used for the canonical_disclaimer -- no new table needed, this
-- is exactly the "singleton piece of text/config an admin edits" shape
-- that table already exists for.
--
-- No migration file in this repo actually created site_content itself
-- (it was applied directly on the server at some earlier point, same as
-- several other tables -- see deployment-mechanism notes); this migration
-- only adds the new row, which is all that's needed here.
--
-- Schema confirmed live via psql against forgewell_db before writing this:
--   site_content(key text primary key, body text not null, updated_at
--   timestamptz not null default now()) -- currently holds exactly one
--   row, key='canonical_disclaimer'.
--
-- 75.00 is a placeholder starting value (matches the example in the
-- product spec, "orders over $75 ship free") -- change it via the new
-- admin.html Content > Free Shipping tab, not by re-running this file.
--
-- Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f free-shipping-threshold-migration.sql

BEGIN;

INSERT INTO site_content (key, body)
VALUES ('free_shipping_threshold', '75.00')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- ============================================================
-- Verification query -- run after COMMIT to confirm:
--   SELECT * FROM site_content WHERE key = 'free_shipping_threshold';
--   -- should return one row, body = '75.00' (or whatever an admin has
--   -- since changed it to, if this is being re-run after the fact)
-- ============================================================
