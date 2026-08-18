-- Adds 7 new FAQ entries requested for the FAQ page (faqs.html), which
-- renders GET /api/content/faq -- none of these 7 questions currently exist
-- (confirmed against the live API response, 6 rows, ids 1-6).
--
-- Schema confirmed live via psql against forgewell_db before writing this
-- (the earlier version of this file guessed a table named `faqs` with just
-- question/answer columns -- both wrong, corrected below):
--   faq_items(id integer PK default nextval(...), sort_order integer NOT
--   NULL no default, question text NOT NULL, answer text NOT NULL,
--   updated_at timestamptz NOT NULL default now())
-- The existing 6 rows have sort_order 1-6, matching id exactly (no gaps),
-- so this continues that sequence at 7-13 in the same order the questions
-- were requested in. sort_order has no default, so it must be set
-- explicitly or every INSERT below fails.
--
-- Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f faq-content-additions.sql

BEGIN;

INSERT INTO faq_items (sort_order, question, answer) VALUES
(7, 'What Size Vials Do Your Peptides come in?',
 'All peptides are sold in 3ml glass vials.'),

(8, 'What are Research Peptides used for?',
 'Peptides are widely used in chemistry and play a key role in many experiments. This may involve protein purification, protein modification, and various interactional studies. We are solely a research supply company. Our products are intended for experienced researchers only. We do not include instructions or directions.'),

(9, 'I Received the Wrong Item',
 'Although mistakes happen, our shipping department works diligently to ensure each parcel is handled with care. If you receive the wrong item please email or text us as soon as possible with your order number and a photo of the items you received. We will correct the problem immediately and send out the correct item(s) on the same or next business day that we are made aware of the issue. You must submit a photo of the items received in order for us to process a reshipment.'),

(10, 'I Entered The Wrong Shipping Address at Checkout, What Should I Do?',
 'Orders ship from our facility 5 days a week, Monday through Friday, excluding holidays. If you contact us prior to the shipment being sent out we will do our best to get the correct address updated. Send an email to support@forgewellpeptide.com with your name, order number, and updated address. If your order has already shipped we are unable to do anything further. See our <a href="/shipping.html">Shipping &amp; Returns Policy</a> for more details.'),

(11, 'My Package Says Delivered But I Have Not Received It. What Should I Do?',
 'Although carrier issues are beyond our control, we recommend looking around your property for the package. Sometimes carriers leave parcels in inconspicuous areas for safety reasons or they may have delivered to a neighbor next door. If your package says delivered but you have not received it, complete the following steps in order for us to reship your items: 1. Contact your local post office or, if you have a relationship with your delivery person, ask them to check their truck/facility. 2. File a lost package claim with your carrier (USPS: https://onlineclaims.usps.com/). All the information you need can be found in the tracking email we sent you. 3. Forward us the claim number or a screenshot of the confirmation email and our shipping department will discuss your reshipment.'),

(12, 'What Shipping Carriers Do You Work With?',
 'We ship with USPS and UPS.'),

(13, 'Refunds and Cancellations',
 'We offer free replacements on items that have been damaged during transport/shipping. If you received a damaged or broken item, please send us a photo immediately so we can send out a new product. See our <a href="/shipping.html">Shipping &amp; Returns Policy</a> for more details.');

COMMIT;

-- ============================================================
-- Verification query -- run after COMMIT to confirm the fix:
--   SELECT id, sort_order, question FROM faq_items ORDER BY sort_order;
--   -- should show the original 6 plus these 7 new rows, ids 7-13
-- ============================================================
