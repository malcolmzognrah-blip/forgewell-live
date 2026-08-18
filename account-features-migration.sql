-- Migration for ACCOUNT-FEATURES-BACKEND-SPEC.md: Addresses default flag,
-- a real coupons table (replacing the hardcoded FORGE15 constant in
-- routes/checkout.js), and the store_credit_transactions ledger.
--
-- Schema confirmed live via psql against forgewell_db before writing this
-- (customers.id / orders.id / customer_addresses.id are all `text` with a
-- gen_random_uuid()::text default, not native `uuid` -- matched here for
-- consistency with every existing table).
--
-- Review before running. Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f account-features-migration.sql

BEGIN;

-- ============================================================
-- 1. Addresses: default-address flag
-- ============================================================
ALTER TABLE customer_addresses
  ADD COLUMN is_default boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. Coupons -- generalizes the single hardcoded FORGE15 code in
-- routes/checkout.js into a real table. coupon_redemptions (which already
-- exists) is left untouched -- see the note below.
-- ============================================================
CREATE TABLE coupons (
  code               text PRIMARY KEY,
  discount_type      text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value     numeric(10,2) NOT NULL CHECK (discount_value > 0),
  active             boolean NOT NULL DEFAULT true,
  expires_at         timestamp with time zone,
  per_customer_limit integer NOT NULL DEFAULT 1 CHECK (per_customer_limit > 0),
  created_at         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT coupons_percent_value_range CHECK (discount_type != 'percent' OR discount_value <= 100)
);

-- Seeds the existing FORGE15 code so it keeps working unchanged once
-- routes/checkout.js switches from its hardcoded constant to this table --
-- same 15%, same single-use-per-email behavior as today.
INSERT INTO coupons (code, discount_type, discount_value, per_customer_limit)
VALUES ('FORGE15', 'percent', 15, 1);

-- NOTE -- read before creating any coupon with per_customer_limit > 1:
-- coupon_redemptions already has a UNIQUE(email, code) constraint from
-- before this feature (this is what made FORGE15 single-use-per-email in
-- the first place). That constraint is NOT changed by this migration, so
-- a coupon with per_customer_limit > 1 will still only ever allow ONE
-- redemption per email in practice -- a second attempt hits the unique
-- constraint and the checkout fails with a generic error, even though
-- routes/checkout.js's own limit check would have allowed it. Keep every
-- coupon's limit at 1 (the default) until/unless coupon_redemptions is
-- separately restructured to allow multiple rows per email+code.

-- ============================================================
-- 3. Store credit -- a ledger (every issuance/redemption is its own row),
-- not a single mutable balance column, so the balance is always derivable
-- and independently auditable. No admin-identity column (created_by) --
-- admin auth here is a single shared password (see routes/admin.js), not
-- individual admin accounts, so there's no admin id to reference.
-- ============================================================
CREATE TABLE store_credit_transactions (
  id           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  customer_id  text NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  type         text NOT NULL CHECK (type IN ('issued', 'redeemed')),
  reason       text,
  order_id     text REFERENCES orders(id),
  created_at   timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_store_credit_transactions_customer_id ON store_credit_transactions(customer_id);

COMMIT;
