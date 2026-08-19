-- Merges the two separate Insulin Needles product listings into one
-- product with quantity tiers, using the same pattern as every other
-- dosage-tiered product on the site (multiple product rows sharing a
-- common base name, grouped client-side by baseLabel() -- see
-- product.html/shop.html/home.html) rather than a single row with an
-- embedded array. No row is deleted -- both ids survive as sibling tier
-- rows, which is what makes them collapse into one shop.html card and one
-- product.html "SELECT QUANTITY" selector, with no risk to the one
-- historical order that already references insulin-needles-small-pack in
-- its (denormalized, DB-independent) line_items snapshot:
--
--   SELECT id, created_at, line_items FROM orders
--     WHERE line_items::text ILIKE '%insulin-needles%';
--   -> order 9c8a1542-982e-4762-8897-4c77b9d5332c (2026-08-10), line_items
--      already has its own frozen {name, unitPrice, lineTotal} copy, not a
--      live join against products -- unaffected either way.
--
-- Confirmed before writing this: both rows already share the exact same
-- image_path ('images/insulin-needles.png') -- there was never a second
-- photo to choose between, despite how the task was described. The
-- "two separate listings" were two full-price, non-grouped cards using
-- one identical photo, not a photo mismatch.
--
-- baseLabel()'s grouping regex only recognized mg/mcg/iu/ml as a trailing
-- unit token before this -- extended (in the 3 files that duplicate it:
-- product.html, shop.html, home.html) to also recognize "ct" so
-- "Insulin Needles (10ct)"/"(100ct)" strip down to the same "Insulin
-- Needles" base label and group into one card/selector, the same way
-- "BPC-157 (5mg)"/"(10mg)" already do.
--
-- Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f insulin-needles-tier-merge.sql

BEGIN;

UPDATE products SET
  name = 'Insulin Needles (10ct)',
  dosage = '10ct',
  price = 10.50,
  bullets = 'Not a chemical — sterile hardware
Standard insulin syringes for research reconstitution/administration protocols
31G, 5/16" needle'
WHERE id = 'insulin-needles-small-pack';

UPDATE products SET
  name = 'Insulin Needles (100ct)',
  dosage = '100ct',
  price = 95.00,
  bullets = 'Not a chemical — sterile hardware
Standard insulin syringes for research reconstitution/administration protocols
31G, 5/16" needle'
WHERE id = 'insulin-needles-large-pack';

COMMIT;

-- ============================================================
-- Verification query -- run after COMMIT to confirm:
--   SELECT id, name, dosage, price FROM products
--     WHERE id IN ('insulin-needles-small-pack', 'insulin-needles-large-pack');
--   -- should show "Insulin Needles (10ct)" at $10.50 and
--   -- "Insulin Needles (100ct)" at $95.00
-- ============================================================
