-- Seed data for product-ingredients-migration.sql -- batch 1 of the amino
-- blend rollout (BCAA 2:1:1, Body Boost, Energy Lipo Blend, Hair Skin
-- Nails Blend). More batches to follow for the rest of the amino blends
-- (Power Blitz, Recovery Rush, Helios Extreme, Power Burn, MIC Blend,
-- Peak Performance, Tri Immune Blend, Sleep Mix, Pump XL/XXL, Neuro
-- Spark, Metabolic Fire, Morning Relax).
--
-- Each product's dosage field is updated from the 'vial' placeholder to
-- its real volume spec (rendered as product.html's "Volume: X" line),
-- alongside its product_ingredients rows (rendered as the Ingredient
-- Profile table).
--
-- Requires product-ingredients-migration.sql to have been applied first.
-- Review before running. Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f product-ingredients-seed.sql

BEGIN;

-- ============================================================
-- BCAA 2:1:1 -- no per-ingredient breakdown given (it's a ratio, not a
-- list of dosed actives), so this gets a single row describing the ratio
-- itself rather than a real multi-row breakdown. That's enough to trip
-- product.html's hasIngredients check (category='amino' + >=1 row) and
-- get the Volume line without a second, separate no-ingredients code
-- path -- see this session's discussion.
-- ============================================================
UPDATE products SET dosage = '2:1:1 Ratio 20mL Vial' WHERE id = 'bcaa-211';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('bcaa-211', 'BCAA (Leucine:Isoleucine:Valine)', '2:1:1 Ratio', 1);

-- ============================================================
-- Body Boost
-- ============================================================
UPDATE products SET dosage = '20mL Vial' WHERE id = 'body-boost';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('body-boost', 'N-Acetyl Cysteine', '50mg/mL', 1),
  ('body-boost', 'Proline', '50mg/mL', 2),
  ('body-boost', 'Histidine HCL', '25mg/mL', 3),
  ('body-boost', 'Glycine', '25mg/mL', 4),
  ('body-boost', 'Lysine', '25mg/mL', 5),
  ('body-boost', 'Valine', '25mg/mL', 6),
  ('body-boost', 'BCAA', '25mg/mL', 7);

-- ============================================================
-- Energy Lipo Blend
-- ============================================================
UPDATE products SET dosage = '20mL Vial' WHERE id = 'energy-lipo-blend';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('energy-lipo-blend', 'L-Carnitine', '200mg/mL', 1),
  ('energy-lipo-blend', 'B12', '250mcg/mL', 2),
  ('energy-lipo-blend', 'B6', '25mg/mL', 3),
  ('energy-lipo-blend', 'Inositol', '50mg/mL', 4),
  ('energy-lipo-blend', 'Methionine', '25mg/mL', 5),
  ('energy-lipo-blend', 'Choline', '50mg/mL', 6);

-- ============================================================
-- Hair Skin Nails Blend
-- ============================================================
UPDATE products SET dosage = '20mL Vial', stock_status = 'out_of_stock' WHERE id = 'hair-skin-nails-blend';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('hair-skin-nails-blend', 'Niacinamide', '50mg', 1),
  ('hair-skin-nails-blend', 'Thiamine HCL', '50mg', 2),
  ('hair-skin-nails-blend', 'Pantothenic Acid', '25mg', 3),
  ('hair-skin-nails-blend', 'Choline', '10mg', 4),
  ('hair-skin-nails-blend', 'Inositol', '10mg', 5),
  ('hair-skin-nails-blend', 'Niacin', '5mg', 6),
  ('hair-skin-nails-blend', 'Biotin', '100mcg', 7),
  ('hair-skin-nails-blend', 'Folic Acid', '100mg', 8);

COMMIT;
