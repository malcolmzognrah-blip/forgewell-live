-- Adds admin-editable Shipping Policy content, mirroring the existing
-- about_us_sections table exactly (see admin.html's Content > About Us tab
-- and routes/content.js / routes/admin.js's about-us handlers) rather than
-- inventing a new shape. Confirmed live via psql against forgewell_db
-- before writing this:
--   \dt showed 19 tables including about_us_sections, faq_items, and a
--   generic key/body site_content table (used only for the singleton
--   canonical_disclaimer row) -- no existing table already fits an ordered
--   list of headed sections for shipping.html, so this adds one rather
--   than repurposing site_content (wrong shape -- one row per key, not an
--   ordered list) or faq_items (wrong columns -- question/answer, not
--   heading/body).
--
--   about_us_sections(id integer PK default nextval(...), sort_order
--   integer NOT NULL no default, heading text NOT NULL, body text NOT
--   NULL, updated_at timestamptz NOT NULL default now())
--
-- shipping_policy_sections copies that shape verbatim. Seed content below
-- is copied from the current static shipping.html (as of this migration)
-- so nothing changes on the live page until an admin edits it in
-- admin.html's new Content > Shipping Policy tab.
--
-- "Returns Policy" becomes a 5th section (sort_order 5) at the same <h2>
-- level as the others, rather than a second <h1> the way the static page
-- has it today -- about_us_sections has no "heading level" column, and
-- adding one just for this one section wasn't worth it. Minor visual
-- change (smaller heading), flagged for review.
--
-- Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f shipping-policy-migration.sql

BEGIN;

CREATE TABLE shipping_policy_sections (
  id          SERIAL PRIMARY KEY,
  sort_order  integer NOT NULL,
  heading     text NOT NULL,
  body        text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO shipping_policy_sections (sort_order, heading, body) VALUES
(1, 'Shipping Rates',
 'Shipping is calculated at checkout based on your order subtotal:

<ul>
  <li><strong>Orders of $150 or more:</strong> Free shipping</li>
  <li><strong>Orders under $150:</strong> Flat rate of $9.95</li>
</ul>'),

(2, 'Order Processing',
 'Orders are processed once payment is confirmed. You''ll receive an order confirmation by email as soon as your order is placed, and a separate notice once it ships.'),

(3, 'Where We Ship',
 'We currently ship within the United States.'),

(4, 'Questions',
 'If you have questions about an order or its shipping status, contact us at <a href="mailto:support@forgewellpeptide.com">support@forgewellpeptide.com</a>.'),

(5, 'Returns Policy',
 'Because our products are sold for research and laboratory use only, all sales are final and Forgewell LLC does not offer refunds, returns, or exchanges, except as described below.

If an order arrives damaged, incorrect, or does not match what was ordered, contact us at <a href="mailto:support@forgewellpeptide.com">support@forgewellpeptide.com</a> within a reasonable period after delivery so we can review the issue. Approved resolutions are at Forgewell LLC''s sole discretion and may include a replacement or store credit.');

COMMIT;

-- ============================================================
-- Verification query -- run after COMMIT to confirm:
--   SELECT id, sort_order, heading FROM shipping_policy_sections ORDER BY sort_order;
--   -- should show 5 rows, ids 1-5
-- ============================================================
