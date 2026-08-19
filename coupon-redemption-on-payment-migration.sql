-- Migration: track which coupon (if any) was applied to an order, so that
-- routes/checkout.js can stop inserting into coupon_redemptions at order
-- CREATION time and routes/webhook.js can insert it instead once payment
-- actually succeeds. Previously, applying a coupon at checkout burned the
-- customer's single use of it immediately -- even if they abandoned the
-- cart or payment failed -- because coupon_redemptions was written inside
-- the same transaction as the order INSERT, not on payment confirmation.
--
-- coupon_redemptions itself (and its pre-existing UNIQUE(email, code)
-- constraint) is untouched -- this only adds a column to `orders` so the
-- webhook has enough information, when a payment lands, to know which
-- coupon (if any) to credit.
--
-- Schema confirmed live via psql against forgewell_db before writing this.
--
-- Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f coupon-redemption-on-payment-migration.sql

BEGIN;

ALTER TABLE orders
  ADD COLUMN coupon_code text REFERENCES coupons(code);

COMMIT;
