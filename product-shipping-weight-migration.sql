-- Adds a per-product shipping weight column, needed for real UPS/FedEx
-- (and later USPS) rate quotes -- carriers require actual package weight,
-- and nothing in this schema tracked it before this (products.
-- molecular_weight is the compound's chemical molecular mass, a
-- completely different thing, already confirmed unrelated before writing
-- this).
--
-- Nullable and left unpopulated by this migration on purpose: real
-- per-product weights still need to be measured/entered per product (or
-- per dosage tier, if that's how they vary -- TBD with the business).
-- lib/shipping/index.js falls back to a conservative placeholder default
-- (DEFAULT_ITEM_WEIGHT_OZ) for any product where this is still null, so
-- the carrier-rate integration works today and can be tightened later by
-- just filling in real values here -- no code or schema change needed
-- when that data becomes available.
--
-- Schema confirmed live via psql against forgewell_db before writing this.
--
-- Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f product-shipping-weight-migration.sql

BEGIN;

ALTER TABLE products
  ADD COLUMN weight_oz numeric(10,2);

COMMENT ON COLUMN products.weight_oz IS
  'Shipping weight in ounces for ONE unit of this product (vial, kit, etc.), used for real carrier rate quotes. NULL until populated -- see lib/shipping/index.js for the placeholder fallback used until then.';

COMMIT;

-- ============================================================
-- Verification query -- run after COMMIT to confirm:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'products' AND column_name = 'weight_oz';
--   -- should return one row
-- ============================================================
