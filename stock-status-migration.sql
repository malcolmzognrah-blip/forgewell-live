-- Adds a manually-controlled in_stock/out_of_stock flag (no numeric inventory
-- tracking -- the user sets this by hand via psql), a separate units_sold
-- counter for reporting only (never drives the stock display), and a table
-- to capture "Notify When In Stock" email signups per product. See plan for
-- stock status + kit price ranges feature.

ALTER TABLE products ADD COLUMN stock_status TEXT NOT NULL DEFAULT 'in_stock';
ALTER TABLE products ADD CONSTRAINT products_stock_status_valid
  CHECK (stock_status IN ('in_stock', 'out_of_stock'));

ALTER TABLE products ADD COLUMN units_sold INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD CONSTRAINT products_units_sold_nonneg CHECK (units_sold >= 0);

CREATE TABLE stock_notifications (
  id SERIAL PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (product_id, email)
);
