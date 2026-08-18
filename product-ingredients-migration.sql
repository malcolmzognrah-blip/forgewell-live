-- Adds a product_ingredients table for amino blend products (Power Blitz,
-- Recovery Rush, MIC Blend, Tri Immune Blend, etc.) -- one row per
-- ingredient, since each blend has a different number of ingredients.
-- Single-actives already on the amino tab (L-Carnitine tiers, NAC, B6,
-- B12, Vitamin C, Yohimbine HCL, Acetyl D-Glucosamine, Vitality Vibe) get
-- no rows here and keep their normal dosage selector on product.html --
-- see the has-rows check below, not category alone.
--
-- Review before running. Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f product-ingredients-migration.sql

CREATE TABLE product_ingredients (
  id              SERIAL PRIMARY KEY,
  product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  concentration   TEXT NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_product_ingredients_product_id ON product_ingredients(product_id, sort_order);

-- ============================================================
-- Backend contract (GET /api/products) -- not implemented in this repo,
-- the API lives outside it per CLAUDE.md. product.html expects each
-- product object to carry an `ingredients` array (aggregated LEFT JOIN,
-- same "denormalize onto the product row" pattern product_specs already
-- uses for spec_* -- an array here instead of flattened columns since
-- this is one-to-many, unlike the single-row COA snapshot):
--
--   ingredients: [{ "ingredient_name": "L-Carnitine", "concentration": "500mg" }, ...]
--
-- Ordered by sort_order, `[]` (or field omitted) for a product with no
-- rows -- product.html's detection is:
--   product.category === 'amino' && Array.isArray(product.ingredients) && product.ingredients.length > 0
-- i.e. category AND real rows, not category alone (Vitality Vibe, the
-- L-Carnitine tiers, NAC, etc. are amino but single-ingredient and must
-- keep the normal dosage selector).
--
-- Suggested query to produce it, same shape as product_specs' join:
--   SELECT product_id, json_agg(
--     json_build_object('ingredient_name', ingredient_name, 'concentration', concentration)
--     ORDER BY sort_order
--   ) AS ingredients
--   FROM product_ingredients
--   GROUP BY product_id
--
-- No admin UI for entering these rows in this pass -- population is
-- manual SQL for now, same as products.stock_status today.
