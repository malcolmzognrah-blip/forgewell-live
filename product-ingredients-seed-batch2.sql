-- Seed data for product-ingredients-migration.sql -- batch 2 of the amino
-- blend rollout: the remaining 19 amino products with confirmed data
-- (Acetyl D-Glucosamine, B12, B6, Helios Extreme, Metabolic Fire, MIC
-- Blend, Morning Relax, NAC, Neuro Spark, Peak Performance, Power Blitz,
-- Power Burn, Pump XL, Pump XXL, Recovery Rush, Sleep Mix, Vitality
-- Vibe, Vitamin C, Yohimbine HCL), plus the Acetyl D-Glucosamine
-- stock_status update. The other requested stock_status update (Hair
-- Skin Nails Blend) was folded into batch 1's product-ingredients-seed.sql
-- instead, since that's where its dosage UPDATE already lives.
--
-- Still outstanding after this batch: Tri Immune Blend -- no
-- ingredient/volume data given for it yet, so its dosage stays the
-- 'vial' placeholder and it gets no product_ingredients rows here.
-- Marked out_of_stock below in the meantime rather than left buyable
-- with no real spec info; flip it back to 'in_stock' once its real
-- data lands in a future batch.
--
-- The single-active items below (Acetyl D-Glucosamine, B12, B6, NAC,
-- Vitality Vibe, Vitamin C, Yohimbine HCL) get exactly one
-- product_ingredients row each, same treatment as BCAA 2:1:1 in batch 1
-- -- there's no separate "volume line with no table" code path, so one
-- row is what trips product.html's hasIngredients check and renders the
-- Volume line (the resulting one-row table is expected, not a bug).
--
-- L-Carnitine (l-carnitine-low/400mg/high) is deliberately NOT touched
-- here or given any product_ingredients rows -- per this session's
-- discussion it needs real dosage tiers instead of an ingredient table,
-- and checking the live catalog, it already has them: three separate
-- rows with dosage = 200mg/400mg/600mg and names formatted
-- "L-Carnitine (200mg)" etc. product.html's groupKeyFor()/baseLabel()
-- already strips that trailing "(Nmg)" annotation and groups the three
-- as SELECT MG siblings today, exactly like any other real dosage-tier
-- product -- no migration needed, this "tier split" is already done.
--
-- Requires product-ingredients-migration.sql to have been applied first.
-- Review before running. Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f product-ingredients-seed-batch2.sql

BEGIN;

-- ============================================================
-- Acetyl D-Glucosamine (single active)
-- ============================================================
UPDATE products SET dosage = '150mg/mL 20mL Vial', stock_status = 'out_of_stock' WHERE id = 'acetyl-d-glucosamine';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('acetyl-d-glucosamine', 'Acetyl D-Glucosamine', '150mg/mL', 1);

-- ============================================================
-- B12 (single active)
-- ============================================================
UPDATE products SET dosage = '1mg/mL 20mL Vial' WHERE id = 'b12';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('b12', 'B12', '1mg/mL', 1);

-- ============================================================
-- B6 (single active)
-- ============================================================
UPDATE products SET dosage = '100mg/mL 20mL Vial' WHERE id = 'b6';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('b6', 'B6', '100mg/mL', 1);

-- ============================================================
-- Helios Extreme
-- ============================================================
UPDATE products SET dosage = '20mL Vial' WHERE id = 'helios-extreme';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('helios-extreme', 'L-Carnitine', '400mg/mL', 1),
  ('helios-extreme', 'ATP', '20mg/mL', 2),
  ('helios-extreme', 'Yohimbine HCL', '5mg/mL', 3),
  ('helios-extreme', 'B-12', '1mg/mL', 4),
  ('helios-extreme', 'Albuterol', '2mg/mL', 5);

-- ============================================================
-- Metabolic Fire
-- ============================================================
UPDATE products SET dosage = '20mL Vial' WHERE id = 'metabolic-fire';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('metabolic-fire', 'L-Carnitine', '400mg/mL', 1),
  ('metabolic-fire', 'MIC Blend', '100mg/mL', 2),
  ('metabolic-fire', 'ATP', '50mg/mL', 3),
  ('metabolic-fire', 'Albuterol', '2mg/mL', 4),
  ('metabolic-fire', 'B12', '1mg/mL', 5);

-- ============================================================
-- MIC Blend
-- ============================================================
UPDATE products SET dosage = '20mL Vial' WHERE id = 'mic-blend';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('mic-blend', 'Methionine', '25mg/mL', 1),
  ('mic-blend', 'Inositol', '50mg/mL', 2),
  ('mic-blend', 'Choline', '25mg/mL', 3);

-- ============================================================
-- Morning Relax
-- ============================================================
UPDATE products SET dosage = '20mL Vial' WHERE id = 'morning-relax';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('morning-relax', 'GABA', '100mg', 1),
  ('morning-relax', 'Arginine', '100mg', 2),
  ('morning-relax', 'Magnesium Glycinate', '100mg', 3),
  ('morning-relax', 'Theanine', '50mg', 4),
  ('morning-relax', 'Taurine', '50mg', 5),
  ('morning-relax', 'Glutamine', '25mg', 6);

-- ============================================================
-- NAC (single active -- ingredient name spelled out since the product's
-- own display name, "NAC", is the abbreviation)
-- ============================================================
UPDATE products SET dosage = 'N-Acetyl Cysteine 100mg/mL 20mL Vial' WHERE id = 'nac';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('nac', 'N-Acetyl Cysteine', '100mg/mL', 1);

-- ============================================================
-- Neuro Spark
-- ============================================================
UPDATE products SET dosage = '20mL Vial' WHERE id = 'neuro-spark';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('neuro-spark', 'Choline Chloride', '200mg', 1),
  ('neuro-spark', 'L-Carnosine', '200mg', 2),
  ('neuro-spark', 'ATP', '40mg', 3),
  ('neuro-spark', 'AMP', '5mg', 4);

-- ============================================================
-- Peak Performance
-- ============================================================
UPDATE products SET dosage = '20mL Vial' WHERE id = 'peak-performance';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('peak-performance', 'Glutamine', '25mg', 1),
  ('peak-performance', 'Agmatine', '50mg', 2),
  ('peak-performance', 'Arginine', '50mg', 3),
  ('peak-performance', 'Acetyl L-Carnitine', '200mg', 4),
  ('peak-performance', 'Carnitine', '200mg', 5);

-- ============================================================
-- Power Blitz
-- ============================================================
UPDATE products SET dosage = '20mL Vial' WHERE id = 'power-blitz';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('power-blitz', 'Carnitine', '400mg/mL', 1),
  ('power-blitz', 'ATP', '40mg/mL', 2),
  ('power-blitz', 'AMP', '5mg', 3);

-- ============================================================
-- Power Burn
-- ============================================================
UPDATE products SET dosage = '20mL Vial' WHERE id = 'power-burn';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('power-burn', 'Albuterol', '2mg/mL', 1),
  ('power-burn', 'Yohimbine', '5mg/mL', 2);

-- ============================================================
-- Pump XL
-- ============================================================
UPDATE products SET dosage = '20mL Vial' WHERE id = 'pump-xl';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('pump-xl', 'L-Arginine', '100mg/mL', 1),
  ('pump-xl', 'L-Ornithine', '100mg/mL', 2),
  ('pump-xl', 'L-Citrulline', '100mg/mL', 3),
  ('pump-xl', 'Lysine', '100mg/mL', 4),
  ('pump-xl', 'Glycine', '50mg/mL', 5);

-- ============================================================
-- Pump XXL
-- ============================================================
UPDATE products SET dosage = '20mL Vial' WHERE id = 'pump-xxl';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('pump-xxl', 'L-Arginine', '100mg/mL', 1),
  ('pump-xxl', 'L-Citrulline', '100mg/mL', 2),
  ('pump-xxl', 'L-Ornithine', '100mg/mL', 3),
  ('pump-xxl', 'L-Glutamine', '100mg/mL', 4),
  ('pump-xxl', 'L-Glycine', '50mg/mL', 5),
  ('pump-xxl', 'L-Lysine', '50mg/mL', 6),
  ('pump-xxl', 'BCAA 2:1:1', '5mg/mL', 7),
  ('pump-xxl', 'Taurine', '50mg/mL', 8);

-- ============================================================
-- Recovery Rush
-- ============================================================
UPDATE products SET dosage = '20mL Vial' WHERE id = 'recovery-rush';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('recovery-rush', 'N-Acetyl Cysteine', '100mg/mL', 1),
  ('recovery-rush', 'Choline', '25mg/mL', 2),
  ('recovery-rush', 'Glycine', '50mg/mL', 3),
  ('recovery-rush', 'Glutathione', '100mg/mL', 4),
  ('recovery-rush', 'Taurine', '25mg/mL', 5),
  ('recovery-rush', 'Glutamine', '25mg/mL', 6);

-- ============================================================
-- Sleep Mix
-- ============================================================
UPDATE products SET dosage = '20mL Vial' WHERE id = 'sleep-mix';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('sleep-mix', 'GABA', '100mg', 1),
  ('sleep-mix', 'Melatonin', '1mg', 2),
  ('sleep-mix', 'Arginine', '100mg', 3),
  ('sleep-mix', 'Glutamine', '25mg', 4);

-- ============================================================
-- Vitality Vibe (single active)
-- ============================================================
UPDATE products SET dosage = 'L-Carnosine 200mg/mL 20mL Vial' WHERE id = 'vitality-vibe';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('vitality-vibe', 'L-Carnosine', '200mg/mL', 1);

-- ============================================================
-- Vitamin C (single active)
-- ============================================================
UPDATE products SET dosage = '250mg/mL 20mL Vial' WHERE id = 'vitamin-c';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('vitamin-c', 'Vitamin C', '250mg/mL', 1);

-- ============================================================
-- Yohimbine HCL (single active)
-- ============================================================
UPDATE products SET dosage = '5mg/mL 20mL Vial' WHERE id = 'yohimbine-hcl';

INSERT INTO product_ingredients (product_id, ingredient_name, concentration, sort_order) VALUES
  ('yohimbine-hcl', 'Yohimbine HCL', '5mg/mL', 1);

-- ============================================================
-- Tri Immune Blend -- stock_status only, no ingredient/dosage data yet
-- ============================================================
UPDATE products SET stock_status = 'out_of_stock' WHERE id = 'tri-immune-blend';

COMMIT;
