-- Cleanup for duplicate product_ingredients rows: product-ingredients-seed.sql
-- was applied 4x against production and product-ingredients-seed-batch2.sql
-- (an earlier revision, before the Tri Immune Blend stock_status section was
-- added) was applied 2x -- neither file has an idempotency guard, so every
-- re-run just inserted the same rows again. Confirmed via GET /api/products:
-- every seeded product's ingredient count was an exact 2x/4x multiple of
-- what was seeded (hair-skin-nails-blend was 31 = 7 (one early run, before
-- Folic Acid was added) + 8*3 (three later runs, after) -- same root cause,
-- just crossing an edit).
--
-- This: (1) dedupes existing rows back down to one per real ingredient,
-- (2) adds a UNIQUE constraint so a future accidental re-run fails loudly
-- with a constraint violation and rolls back, instead of silently
-- duplicating again, (3) applies the one statement that never landed from
-- batch 2 (Tri Immune Blend -> out_of_stock).
--
-- Review before running. Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f product-ingredients-cleanup.sql

BEGIN;

-- 1. Dedup: for any set of rows on the same product with identical
-- ingredient_name/concentration/sort_order (i.e. the same real row
-- inserted more than once), keep exactly one.
DELETE FROM product_ingredients a
USING product_ingredients b
WHERE a.id < b.id
  AND a.product_id = b.product_id
  AND a.ingredient_name = b.ingredient_name
  AND a.concentration = b.concentration
  AND a.sort_order = b.sort_order;

-- 2. Guard rail: sort_order is already meant to be a unique position per
-- product (1, 2, 3, ... per product_id) -- enforcing that means a repeat
-- INSERT of the same seed data now hits a constraint violation and the
-- whole transaction rolls back cleanly, rather than silently duplicating
-- rows again the way this incident happened.
ALTER TABLE product_ingredients
  ADD CONSTRAINT product_ingredients_product_sort_unique UNIQUE (product_id, sort_order);

-- 3. The one statement from product-ingredients-seed-batch2.sql that never
-- actually ran (it was added to the file after the two runs that did
-- happen) -- Tri Immune Blend still has no ingredient/volume data, so it
-- stays out_of_stock in the meantime, same as originally requested.
UPDATE products SET stock_status = 'out_of_stock' WHERE id = 'tri-immune-blend';

COMMIT;

-- ============================================================
-- Verification queries -- run after COMMIT to confirm the fix:
--
--   SELECT product_id, count(*) FROM product_ingredients GROUP BY product_id
--   HAVING count(*) <> count(DISTINCT sort_order);
--   -- should return 0 rows (no more duplicate sort_order per product)
--
--   SELECT id, stock_status FROM products WHERE id = 'tri-immune-blend';
--   -- should show out_of_stock
-- ============================================================
