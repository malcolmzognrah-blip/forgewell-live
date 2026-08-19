-- Adds a 20mg BPC-157 tier at $105 and marks the existing 5mg tier
-- out_of_stock, following the same multi-tier peptide pattern as every
-- other BPC-157 row. Compound-level fields (bullets, research_use,
-- sequence, molecular_formula, molecular_weight, pubchem_cid, cas_number,
-- lot, purity, data_status) copied verbatim from bpc-157-5mg/10mg, which
-- already match each other exactly -- confirmed via psql before writing
-- this. on_sale/sale_price intentionally NOT copied from bpc-157-10mg
-- (currently on sale at $150) -- a sale is a deliberate per-tier
-- promotion, not something a new tier should silently inherit.
--
-- image_path points at images/bpc-157-20mg-tpl.png, generated via:
--   node -e "require('./generate-dosage-images.js').generate({ name: 'BPC-157', dosage: '20mg', purity: '99', slugSuffix: '-tpl' })"
-- (the '-tpl' suffix matches the existing bpc-157-5mg-tpl.png/
-- bpc-157-10mg-tpl.png sibling filenames -- the plain CLI path defaults to
-- no suffix, so this used generate()'s object form directly instead, the
-- same way scripts/generate-new-tiers.js already does for batch tiers).
--
-- Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f bpc-157-20mg-tier-and-5mg-oos.sql

BEGIN;

INSERT INTO products (
  id, name, category, dosage, price, lot, bullets, research_use, sequence,
  molecular_formula, molecular_weight, pubchem_cid, cas_number, image_path,
  data_status, purity, stock_status
) VALUES (
  'bpc-157-20mg',
  'BPC-157 (20mg)',
  'peptide',
  '20mg',
  105.00,
  'FW2607B002',
  E'Research use only\nSupplied as lyophilized powder for extended stability\nPackaged in a 3mL vial',
  'BPC-157 is a synthetic pentadecapeptide derived from a partial sequence of body-protective compound found in gastric juice, studied in research for its role in angiogenesis, tissue repair signaling, and gut-barrier integrity models.',
  'Gly-Glu-Pro-Pro-Pro-Gly-Lys-Pro-Ala-Asp-Asp-Ala-Gly-Leu-Val',
  'C62H98N16O22',
  '1419.53 g/mol',
  '108101',
  '137525-51-0',
  'images/bpc-157-20mg-tpl.png',
  'researched',
  '99',
  'in_stock'
);

UPDATE products SET stock_status = 'out_of_stock' WHERE id = 'bpc-157-5mg';

COMMIT;

-- ============================================================
-- Verification query -- run after COMMIT to confirm:
--   SELECT id, name, dosage, price, stock_status FROM products
--     WHERE id IN ('bpc-157-5mg', 'bpc-157-10mg', 'bpc-157-20mg') ORDER BY id;
--   -- should show 5mg as out_of_stock, 10mg unchanged (still in_stock,
--   -- still on sale), 20mg new at $105.00, in_stock
-- ============================================================
