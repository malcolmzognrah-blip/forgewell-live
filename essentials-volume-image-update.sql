-- Points Bacteriostatic Water and Acetic Acid Water at their new
-- template-composited images (generated via
-- scripts/generate-dosage-images.js "Bacteriostatic Water|30mL" "Acetic
-- Acid Water|30mL"), replacing their old static photos. Confirmed before
-- writing this: both rows already had dosage='vial' (the same "no real
-- tier" placeholder used elsewhere), no siblings, no product_specs/
-- product_ingredients/product_coas rows -- a plain image_path swap, no
-- schema change.
--
-- IMPORTANT DEPLOY ORDER: apply this BEFORE the frontend git pull deploy.
-- The old image files (images/acetic-acid-water.webp and
-- "images/bacteriostatic-water  30ml.webp") were removed from the repo in
-- the same commit as this migration, so a git pull that lands before this
-- runs would leave the live DB pointing at a now-deleted file (broken
-- image) until this is applied.
--
-- Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f essentials-volume-image-update.sql

BEGIN;

UPDATE products SET image_path = 'images/bacteriostatic-water-30ml.png'
  WHERE id = 'bacteriostatic-water';

UPDATE products SET image_path = 'images/acetic-acid-water-30ml.png'
  WHERE id = 'acetic-acid-water';

COMMIT;

-- ============================================================
-- Verification query -- run after COMMIT to confirm:
--   SELECT id, image_path FROM products
--     WHERE id IN ('bacteriostatic-water', 'acetic-acid-water');
-- ============================================================
