-- Part 1: vial changes
-- KLOW is a brand-new sellable vial product; description text adapted
-- from klow-kit's own bullets/research_use per this session's discussion.
INSERT INTO products (
  id, name, category, dosage, price, lot, bullets, research_use, sequence,
  molecular_formula, molecular_weight, pubchem_cid, cas_number, image_path,
  data_status, base_product_id, purity, pack_size, stock_status, units_sold
) VALUES (
  'klow', 'KLOW', 'peptide', '80mg', 130.00, NULL,
  E'Research use only\nMulti-peptide blend\nPackaged in a 3mL vial',
  'KLOW is a multi-peptide blend studied in research for combined applications across tissue repair, recovery, and skin-related research models.',
  NULL, NULL, NULL, NULL, NULL, 'images/klow-tpl.png', 'pending', NULL, '00', NULL, 'in_stock', 0
);

-- MT-2 and PT-141: convert from non-sellable ($0, dosage='vial') to real
-- sellable products. All other fields (sequence, molecular_formula, CAS
-- number, image_path) were already correct/complete -- only price/dosage
-- change, plus appending the standard "Packaged in a 3mL vial" bullet
-- every other real single-vial peptide already has.
UPDATE products
SET price = 40.00, dosage = '10mg', bullets = bullets || E'\nPackaged in a 3mL vial'
WHERE id = 'mt-2';

UPDATE products
SET price = 45.00, dosage = '10mg', bullets = bullets || E'\nPackaged in a 3mL vial'
WHERE id = 'pt-141';

-- Part 2: 8 kit tier-splits (single "pack" placeholder row -> real
-- 5-Pack/10-Pack rows). Each: rename the existing row into the 5-Pack
-- tier, then insert the 10-Pack tier by copying every shared field from
-- it -- same pattern as the SS-31/Vilon vial split earlier this session.

-- Cagrilintide Kit
UPDATE products SET id = 'cagrilintide-kit-5-pack', name = 'Cagrilintide Kit (10mg, 5-Pack)',
  price = 567.00, pack_size = '5-Pack', image_path = 'images/cagrilintide-kit-5-pack-tpl.png'
WHERE id = 'cagrilintide-kit';
INSERT INTO products (id, name, category, dosage, price, lot, bullets, research_use, sequence, molecular_formula, molecular_weight, pubchem_cid, cas_number, image_path, data_status, base_product_id, purity, pack_size, stock_status, units_sold)
SELECT 'cagrilintide-kit-10-pack', 'Cagrilintide Kit (10mg, 10-Pack)', category, dosage, 1071.00, lot, bullets, research_use, sequence, molecular_formula, molecular_weight, pubchem_cid, cas_number, 'images/cagrilintide-kit-10-pack-tpl.png', data_status, base_product_id, purity, '10-Pack', 'in_stock', 0
FROM products WHERE id = 'cagrilintide-kit-5-pack';

-- IGF-1 LR3 Kit
UPDATE products SET id = 'igf1-lr3-kit-5-pack', name = 'IGF-1 LR3 Kit (1mg, 5-Pack)',
  price = 607.50, pack_size = '5-Pack', image_path = 'images/igf1-lr3-kit-5-pack-tpl.png'
WHERE id = 'igf1-lr3-kit';
INSERT INTO products (id, name, category, dosage, price, lot, bullets, research_use, sequence, molecular_formula, molecular_weight, pubchem_cid, cas_number, image_path, data_status, base_product_id, purity, pack_size, stock_status, units_sold)
SELECT 'igf1-lr3-kit-10-pack', 'IGF-1 LR3 Kit (1mg, 10-Pack)', category, dosage, 1147.50, lot, bullets, research_use, sequence, molecular_formula, molecular_weight, pubchem_cid, cas_number, 'images/igf1-lr3-kit-10-pack-tpl.png', data_status, base_product_id, purity, '10-Pack', 'in_stock', 0
FROM products WHERE id = 'igf1-lr3-kit-5-pack';

-- KPV Kit
UPDATE products SET id = 'kpv-kit-5-pack', name = 'KPV Kit (10mg, 5-Pack)',
  price = 202.50, pack_size = '5-Pack', image_path = 'images/kpv-kit-5-pack-tpl.png'
WHERE id = 'kpv-kit';
INSERT INTO products (id, name, category, dosage, price, lot, bullets, research_use, sequence, molecular_formula, molecular_weight, pubchem_cid, cas_number, image_path, data_status, base_product_id, purity, pack_size, stock_status, units_sold)
SELECT 'kpv-kit-10-pack', 'KPV Kit (10mg, 10-Pack)', category, dosage, 382.50, lot, bullets, research_use, sequence, molecular_formula, molecular_weight, pubchem_cid, cas_number, 'images/kpv-kit-10-pack-tpl.png', data_status, base_product_id, purity, '10-Pack', 'in_stock', 0
FROM products WHERE id = 'kpv-kit-5-pack';

-- MT-1 Kit
UPDATE products SET id = 'mt-1-kit-5-pack', name = 'MT-1 Kit (10mg, 5-Pack)',
  price = 162.00, pack_size = '5-Pack', image_path = 'images/mt-1-kit-5-pack-tpl.png'
WHERE id = 'mt-1-kit';
INSERT INTO products (id, name, category, dosage, price, lot, bullets, research_use, sequence, molecular_formula, molecular_weight, pubchem_cid, cas_number, image_path, data_status, base_product_id, purity, pack_size, stock_status, units_sold)
SELECT 'mt-1-kit-10-pack', 'MT-1 Kit (10mg, 10-Pack)', category, dosage, 306.00, lot, bullets, research_use, sequence, molecular_formula, molecular_weight, pubchem_cid, cas_number, 'images/mt-1-kit-10-pack-tpl.png', data_status, base_product_id, purity, '10-Pack', 'in_stock', 0
FROM products WHERE id = 'mt-1-kit-5-pack';

-- SS-31 Kit (base_product_id stays 'ss-31' -- the prefix-match rule already
-- resolves this against ss-31-10mg/ss-31-50mg from the earlier vial split,
-- no update needed here)
UPDATE products SET id = 'ss-31-kit-5-pack', name = 'SS-31 Kit (50mg, 5-Pack)',
  price = 630.00, pack_size = '5-Pack', image_path = 'images/ss-31-kit-5-pack-tpl.png'
WHERE id = 'ss-31-kit';
INSERT INTO products (id, name, category, dosage, price, lot, bullets, research_use, sequence, molecular_formula, molecular_weight, pubchem_cid, cas_number, image_path, data_status, base_product_id, purity, pack_size, stock_status, units_sold)
SELECT 'ss-31-kit-10-pack', 'SS-31 Kit (50mg, 10-Pack)', category, dosage, 1190.00, lot, bullets, research_use, sequence, molecular_formula, molecular_weight, pubchem_cid, cas_number, 'images/ss-31-kit-10-pack-tpl.png', data_status, base_product_id, purity, '10-Pack', 'in_stock', 0
FROM products WHERE id = 'ss-31-kit-5-pack';

-- KLOW Kit -- also sets base_product_id/dosage (both currently NULL) so
-- this kit finally links to its own vial via the same matching rule
-- every other kit uses.
UPDATE products SET id = 'klow-kit-5-pack', name = 'KLOW Kit (80mg, 5-Pack)',
  dosage = '80mg', base_product_id = 'klow',
  price = 585.00, pack_size = '5-Pack', image_path = 'images/klow-kit-5-pack-tpl.png'
WHERE id = 'klow-kit';
INSERT INTO products (id, name, category, dosage, price, lot, bullets, research_use, sequence, molecular_formula, molecular_weight, pubchem_cid, cas_number, image_path, data_status, base_product_id, purity, pack_size, stock_status, units_sold)
SELECT 'klow-kit-10-pack', 'KLOW Kit (80mg, 10-Pack)', category, dosage, 1105.00, lot, bullets, research_use, sequence, molecular_formula, molecular_weight, pubchem_cid, cas_number, 'images/klow-kit-10-pack-tpl.png', data_status, base_product_id, purity, '10-Pack', 'in_stock', 0
FROM products WHERE id = 'klow-kit-5-pack';

-- MT-2 Kit
UPDATE products SET id = 'mt-2-kit-5-pack', name = 'MT-2 Kit (10mg, 5-Pack)',
  price = 180.00, pack_size = '5-Pack', image_path = 'images/mt-2-kit-5-pack-tpl.png'
WHERE id = 'mt-2-kit';
INSERT INTO products (id, name, category, dosage, price, lot, bullets, research_use, sequence, molecular_formula, molecular_weight, pubchem_cid, cas_number, image_path, data_status, base_product_id, purity, pack_size, stock_status, units_sold)
SELECT 'mt-2-kit-10-pack', 'MT-2 Kit (10mg, 10-Pack)', category, dosage, 340.00, lot, bullets, research_use, sequence, molecular_formula, molecular_weight, pubchem_cid, cas_number, 'images/mt-2-kit-10-pack-tpl.png', data_status, base_product_id, purity, '10-Pack', 'in_stock', 0
FROM products WHERE id = 'mt-2-kit-5-pack';

-- PT-141 Kit
UPDATE products SET id = 'pt-141-kit-5-pack', name = 'PT-141 Kit (10mg, 5-Pack)',
  price = 202.50, pack_size = '5-Pack', image_path = 'images/pt-141-kit-5-pack-tpl.png'
WHERE id = 'pt-141-kit';
INSERT INTO products (id, name, category, dosage, price, lot, bullets, research_use, sequence, molecular_formula, molecular_weight, pubchem_cid, cas_number, image_path, data_status, base_product_id, purity, pack_size, stock_status, units_sold)
SELECT 'pt-141-kit-10-pack', 'PT-141 Kit (10mg, 10-Pack)', category, dosage, 382.50, lot, bullets, research_use, sequence, molecular_formula, molecular_weight, pubchem_cid, cas_number, 'images/pt-141-kit-10-pack-tpl.png', data_status, base_product_id, purity, '10-Pack', 'in_stock', 0
FROM products WHERE id = 'pt-141-kit-5-pack';
