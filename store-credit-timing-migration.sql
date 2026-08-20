-- Migration: track how much store credit (if any) was applied to an
-- order, so routes/checkout.js can stop debiting store_credit_transactions
-- at order-creation time for orders that still need to go through PayRam,
-- and routes/webhook.js can debit it instead once payment actually
-- succeeds -- same fix already applied to coupon redemption timing (see
-- coupon-redemption-on-payment-migration.sql).
--
-- An order fully covered by store credit (no PayRam charge needed at all)
-- is a different case: it's paid atomically at creation time, so it still
-- debits immediately in the same transaction -- there's no async
-- confirmation step to defer to. This column exists for the *other* case:
-- an order that still needs PayRam for the remaining balance.
--
-- Schema confirmed live via psql against forgewell_db before writing this.
--
-- Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f store-credit-timing-migration.sql

BEGIN;

ALTER TABLE orders
  ADD COLUMN store_credit_applied_cents integer NOT NULL DEFAULT 0;

COMMIT;
