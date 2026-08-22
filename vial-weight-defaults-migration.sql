-- Fills in a category-based default shipping weight for products that
-- don't have a real one yet, replacing lib/shipping/index.js's generic
-- DEFAULT_ITEM_WEIGHT_OZ (4oz) fallback with a closer-to-real estimate
-- for the two categories that actually vary by a known vial size:
-- Peptides ship in a 3mL vial (~3oz including packaging), Aminos in a
-- 20mL vial (~5oz including packaging) -- these are the business's own
-- estimates, not measured weights (see this migration's own header and
-- the admin.html Products tab's "Shipping Weight" field, which stays
-- freely editable per product to correct these once real weights are
-- measured with a shipping scale, or to override for an individual
-- exception).
--
-- Deliberately WHERE weight_oz IS NULL and scoped to category IN
-- ('peptide', 'amino') only -- confirmed via psql before writing this
-- that every row in every category is currently null (no admin has set
-- a real per-product weight yet), so this is a pure fill, not an
-- overwrite, and would stay that way even if that changes before this
-- runs. 'kit' rows are deliberately excluded: a kit's weight is backing-
-- product-weight x pack quantity, already handled by admin.html's
-- Create Kit form (see routes/admin.js's product create/edit routes'
-- own comments) -- applying a flat category default there would be
-- wrong for anything but a 1-pack. 'essential' rows are also excluded --
-- this request named only Peptides and Aminos, or aren't vial products
-- to begin with (e.g. accessories) that could not fit either estimate.
--
-- THESE ARE PLACEHOLDER ESTIMATES, NOT MEASURED WEIGHTS. Replace them
-- with real values (per-product, via admin.html) once a shipping scale
-- is available.
--
-- Schema confirmed live via psql against forgewell_db before writing this:
--   category counts were amino=27, essential=5, kit=76, peptide=82, and
--   every row across all four categories had weight_oz IS NULL.
--
-- Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f vial-weight-defaults-migration.sql

BEGIN;

UPDATE products SET weight_oz = 3 WHERE category = 'peptide' AND weight_oz IS NULL;
UPDATE products SET weight_oz = 5 WHERE category = 'amino' AND weight_oz IS NULL;

COMMIT;

-- ============================================================
-- Verification query -- run after COMMIT to confirm:
--   SELECT category, weight_oz, COUNT(*) FROM products
--     WHERE category IN ('peptide', 'amino') GROUP BY category, weight_oz;
--   -- should show peptide -> 3, amino -> 5, each with the same row
--   -- count as the pre-migration category totals (82 and 27 here)
-- ============================================================
