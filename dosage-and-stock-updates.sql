-- Fills in real dosage values for 18 products still on the 'vial' placeholder,
-- marks 11 discontinued/out-of-supply products out_of_stock, and splits
-- SS-31 and Vilon into real dosage tiers (SS-31: 10mg/50mg; Vilon: 10mg only,
-- 5mg not actually available). Already applied against the live DB.

-- 1. Single-dosage updates (no tier change)
UPDATE products SET dosage = '50mg' WHERE id = '5-amino-1mq';
UPDATE products SET dosage = '10mg' WHERE id = 'cagrilintide';
UPDATE products SET dosage = '10mg' WHERE id = 'chonluten';
UPDATE products SET dosage = '10mg' WHERE id = 'crystagen';
UPDATE products SET dosage = '10mg' WHERE id = 'epithalon';
UPDATE products SET dosage = '10mg' WHERE id = 'ghrp-2';
UPDATE products SET dosage = '50mg/10mg/10mg' WHERE id = 'glow-pro-blend';
UPDATE products SET dosage = '5mg' WHERE id = 'hexarelin';
UPDATE products SET dosage = '1mg' WHERE id = 'igf1-lr3';
UPDATE products SET dosage = '10mg' WHERE id = 'kisspeptin';
UPDATE products SET dosage = '5mg' WHERE id = 'll-37';
UPDATE products SET dosage = '10mg' WHERE id = 'mt-1';
UPDATE products SET dosage = '20mg' WHERE id = 'ovagen';
UPDATE products SET dosage = '15mg' WHERE id = 'pancragen';
UPDATE products SET dosage = '5mg' WHERE id = 'pnc-27';
UPDATE products SET dosage = '10mg' WHERE id = 'snap-8';
UPDATE products SET dosage = '10mg' WHERE id = 'thymalin';
UPDATE products SET dosage = '20mg' WHERE id = 'vesugen';

-- 2. Stock status updates
UPDATE products SET stock_status = 'out_of_stock'
WHERE id IN ('adamax','ara-290','bronchogen','cartalax','cortagen','ghrp-6','livagen','pinealon','prostamax','survodutide','testagen');

-- 3. SS-31 / Vilon tier split
UPDATE products
SET id = 'ss-31-50mg',
    name = 'SS-31 (50mg)',
    dosage = '50mg',
    price = 140.00,
    image_path = 'images/ss-31-50mg-tpl.png'
WHERE id = 'ss-31';

INSERT INTO products (
  id, name, category, dosage, price, lot, bullets, research_use, sequence,
  molecular_formula, molecular_weight, pubchem_cid, cas_number, image_path,
  data_status, purity, pack_size, stock_status, units_sold
)
SELECT
  'ss-31-10mg', 'SS-31 (10mg)', category, '10mg', 60.00, lot, bullets, research_use, sequence,
  molecular_formula, molecular_weight, pubchem_cid, cas_number, 'images/ss-31-10mg-tpl.png',
  data_status, purity, pack_size, 'in_stock', 0
FROM products WHERE id = 'ss-31-50mg';

UPDATE products
SET id = 'vilon-10mg',
    name = 'Vilon (10mg)',
    dosage = '10mg',
    price = 60.00,
    image_path = 'images/vilon-10mg-tpl.png'
WHERE id = 'vilon';
