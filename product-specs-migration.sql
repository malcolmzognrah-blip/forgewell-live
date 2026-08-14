-- Adds structured per-batch analytical fields to product_coas (entered at
-- COA upload time, alongside the existing coa_path/batch_lot/batch_date),
-- plus a product_specs table that mirrors whichever product_coas row is
-- latest by batch_date for a given product. product.html's "Quality &
-- Testing" section reads product_specs (flattened onto the product row by
-- GET /api/products as spec_appearance/spec_current_lot/spec_purity/
-- spec_endotoxin_threshold/spec_microbial_analysis/spec_fentanyl_screen/
-- spec_net_content_average), not product_coas directly -- product_specs is
-- a denormalized read cache, not a new source of truth.
--
-- Population: whenever a product_coas row is inserted, edited, or deleted,
-- re-derive that product's product_specs row from whichever product_coas
-- row is now latest (ORDER BY batch_date DESC, id DESC -- id as a same-day
-- tiebreak since batch_date has no time component):
--
--   INSERT INTO product_specs (product_id, appearance, current_lot, purity,
--                               endotoxin_threshold, microbial_analysis,
--                               fentanyl_screen, net_content_average,
--                               source_coa_id, updated_at)
--   SELECT product_id, appearance, batch_lot, COALESCE(purity, '99%'),
--          endotoxin_threshold, microbial_analysis, fentanyl_screen,
--          net_content_average, id, now()
--   FROM product_coas
--   WHERE product_id = $1
--   ORDER BY batch_date DESC, id DESC
--   LIMIT 1
--   ON CONFLICT (product_id) DO UPDATE SET
--     appearance = EXCLUDED.appearance, current_lot = EXCLUDED.current_lot,
--     purity = EXCLUDED.purity, endotoxin_threshold = EXCLUDED.endotoxin_threshold,
--     microbial_analysis = EXCLUDED.microbial_analysis,
--     fentanyl_screen = EXCLUDED.fentanyl_screen,
--     net_content_average = EXCLUDED.net_content_average,
--     source_coa_id = EXCLUDED.source_coa_id, updated_at = EXCLUDED.updated_at;
--
-- If a product's last product_coas row is deleted, its product_specs row
-- should be deleted too, not left stale -- GET /api/products should
-- COALESCE(product_specs.purity, '99%') in its LEFT JOIN regardless, so a
-- product with no product_specs row at all (new product, never had a COA)
-- still gets the 99% default rather than a missing field.

ALTER TABLE product_coas ADD COLUMN appearance TEXT;
ALTER TABLE product_coas ADD COLUMN purity TEXT;
ALTER TABLE product_coas ADD COLUMN endotoxin_threshold TEXT;
ALTER TABLE product_coas ADD COLUMN microbial_analysis TEXT;
ALTER TABLE product_coas ADD COLUMN fentanyl_screen TEXT;
ALTER TABLE product_coas ADD COLUMN net_content_average TEXT;

CREATE TABLE product_specs (
  product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  appearance TEXT,
  current_lot TEXT,
  purity TEXT NOT NULL DEFAULT '99%',
  endotoxin_threshold TEXT,
  microbial_analysis TEXT,
  fentanyl_screen TEXT,
  net_content_average TEXT,
  source_coa_id INTEGER REFERENCES product_coas(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
