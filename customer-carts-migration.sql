-- Adds server-side cart persistence for SIGNED-IN customers only --
-- confirmed via grep before writing this that no cart table existed
-- anywhere in this schema; forgewell_cart has always been localStorage-
-- only (see CLAUDE.md's "Client-side state is localStorage, not
-- cookies" section). This table is NOT a new source of truth for
-- rendering the cart anywhere -- localStorage still is, and cart.html's
-- renderCartPage() is untouched -- it exists purely so the abandoned-
-- cart reminder job (lib/jobs.js) has something server-side to poll.
-- Written to by the new routes/cart.js (PUT/DELETE /api/cart/mine),
-- called from inside saveCart() on every page that has one (15 pages,
-- same "no shared JS" duplication as saveCart() itself already has) and
-- from order-confirmation.html's payment-confirmed branch.
--
-- One row per customer (not one row per cart item) -- items is the
-- exact same [{productId,name,price,qty}, ...] shape forgewell_cart
-- already stores, so no join against `products` is needed to build the
-- reminder email. reminder_sent_at is null until a reminder actually
-- goes out for the CURRENT cart state -- any write to this row (any
-- cart touch at all, add/remove/qty-change) resets both updated_at and
-- reminder_sent_at, since a fresh touch restarts the abandonment clock
-- and makes any earlier reminder stale.
--
-- Guest/anonymous carts are never written here at all -- PUT/DELETE
-- /api/cart/mine both require a valid customer session (same
-- requireAuth pattern as routes/store-credit.js), and there's no
-- customer_id to key on for a guest anyway.
--
-- Schema confirmed live via psql against forgewell_db before writing
-- this (customers already existed, owned by postgres -- this new table
-- only needs a FK reference to it, not ownership, so no sudo/postgres
-- run needed here, same reasoning as email_campaigns/
-- store_credit_campaigns before it).
--
-- Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f customer-carts-migration.sql

BEGIN;

CREATE TABLE customer_carts (
  customer_id text PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now(),
  reminder_sent_at timestamptz
);

COMMENT ON TABLE customer_carts IS
  'Server-side mirror of a signed-in customer''s cart (forgewell_cart in localStorage is still the real source of truth for display) -- exists purely so lib/jobs.js''s abandoned-cart reminder job has something to poll. One row per customer, upserted on every cart touch by routes/cart.js.';

COMMIT;

-- ============================================================
-- Verification query -- run after COMMIT to confirm:
--   SELECT to_regclass('customer_carts');
--   -- should return 'customer_carts', not null
-- ============================================================
