-- Adds 7 new FAQ entries requested for the FAQ page (faqs.html), which
-- renders GET /api/content/faq -- none of these 7 questions currently exist
-- (confirmed against the live API response, 6 rows, ids 1-6).
--
-- CAUTION -- unlike every other *-migration.sql file in this repo, the
-- table/column names below are INFERRED, not confirmed live: there's no
-- CREATE TABLE for the FAQ content anywhere in this repo (routes/content.js
-- lives on the server, outside this repo, per CLAUDE.md), so this is a
-- best-effort guess from GET /api/content/faq's response shape alone:
--   [{ "id": 1, "question": "...", "answer": "..." }, ...]
-- ids are small sequential integers (1-6), which reads as a plain
-- SERIAL/INTEGER primary key -- NOT the `text` + gen_random_uuid()::text
-- pattern account-features-migration.sql used for newer tables, so this is
-- presumably an older table from before that convention. Guessed table
-- name: `faqs`. There may also be other columns this doesn't know about
-- (e.g. a sort_order controlling display sequence, timestamps) -- if any
-- of those are NOT NULL with no default, this INSERT will fail outright
-- rather than silently doing the wrong thing, which is the safer failure
-- mode given the uncertainty here.
--
-- BEFORE RUNNING: verify the real table name and columns, e.g.:
--   \d faqs
-- or, if that table doesn't exist:
--   \dt
--   SELECT * FROM <real_table_name> LIMIT 1;
-- and adjust the table/column names below to match before executing.
--
-- Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f faq-content-additions.sql

BEGIN;

INSERT INTO faqs (question, answer) VALUES
('What Size Vials Do Your Peptides come in?',
 'All peptides are sold in 3ml glass vials.'),

('What are Research Peptides used for?',
 'Peptides are widely used in chemistry and play a key role in many experiments. This may involve protein purification, protein modification, and various interactional studies. We are solely a research supply company. Our products are intended for experienced researchers only. We do not include instructions or directions.'),

('I Received the Wrong Item',
 'Although mistakes happen, our shipping department works diligently to ensure each parcel is handled with care. If you receive the wrong item please email or text us as soon as possible with your order number and a photo of the items you received. We will correct the problem immediately and send out the correct item(s) on the same or next business day that we are made aware of the issue. You must submit a photo of the items received in order for us to process a reshipment.'),

('I Entered The Wrong Shipping Address at Checkout, What Should I Do?',
 'Orders ship from our facility 5 days a week, Monday through Friday, excluding holidays. If you contact us prior to the shipment being sent out we will do our best to get the correct address updated. Send an email to support@forgewellpeptide.com with your name, order number, and updated address. If your order has already shipped we are unable to do anything further. See our <a href="/shipping.html">Shipping &amp; Returns Policy</a> for more details.'),

('My Package Says Delivered But I Have Not Received It. What Should I Do?',
 'Although carrier issues are beyond our control, we recommend looking around your property for the package. Sometimes carriers leave parcels in inconspicuous areas for safety reasons or they may have delivered to a neighbor next door. If your package says delivered but you have not received it, complete the following steps in order for us to reship your items: 1. Contact your local post office or, if you have a relationship with your delivery person, ask them to check their truck/facility. 2. File a lost package claim with your carrier (USPS: https://onlineclaims.usps.com/). All the information you need can be found in the tracking email we sent you. 3. Forward us the claim number or a screenshot of the confirmation email and our shipping department will discuss your reshipment.'),

('What Shipping Carriers Do You Work With?',
 'We ship with USPS and UPS.'),

('Refunds and Cancellations',
 'We offer free replacements on items that have been damaged during transport/shipping. If you received a damaged or broken item, please send us a photo immediately so we can send out a new product. See our <a href="/shipping.html">Shipping &amp; Returns Policy</a> for more details.');

COMMIT;

-- ============================================================
-- Verify after COMMIT:
--   SELECT id, question FROM faqs ORDER BY id;
--   -- should show the original 6 plus these 7 new rows
--
-- Also check the live page (faqs.html) after this runs, in case there's a
-- sort_order (or similar) column this INSERT didn't set -- new rows might
-- land in an unexpected position in the displayed list rather than at the
-- end, since this script has no way to know that column exists.
-- ============================================================
