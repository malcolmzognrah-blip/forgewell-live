-- Adds the admin-configurable company phone/business-hours/address as
-- three new site_content rows -- same key/body table already used for
-- the canonical_disclaimer and free_shipping_threshold, no new table
-- needed. footer.html's Contact column showed these as literal
-- "[Phone Number]" / "[Business Hours]" / "[Company Address]" bracket
-- placeholders before this; seeded with that exact placeholder text so
-- nothing visibly changes on the live site until a real admin fills them
-- in via admin.html's Content > Contact Info tab.
--
-- company_address is also the single source of truth for the physical
-- mailing address shown in the Email Campaign feature's outgoing
-- messages (see lib/emailTemplates.js's couponCampaignEmail() and
-- routes/admin.js's POST /campaigns/coupon/send) -- CAN-SPAM requires a
-- valid physical postal address on commercial email, and a placeholder
-- bracket string does NOT satisfy that; a real admin must replace it
-- with the company's actual mailing address before sending a real
-- campaign, same caveat already flagged for marketing_opt_in's default
-- in marketing-opt-in-migration.sql.
--
-- Schema confirmed live via psql against forgewell_db before writing this
-- (site_content already exists, owned by forgewell -- no ownership
-- issue applying this one directly, unlike marketing-opt-in-migration.sql's
-- customers/email_campaigns, which needed running as postgres).
--
-- Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f company-contact-info-migration.sql

BEGIN;

INSERT INTO site_content (key, body) VALUES
  ('company_phone', '[Phone Number]'),
  ('company_business_hours', '[Business Hours]'),
  ('company_address', '[Company Address]')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- ============================================================
-- Verification query -- run after COMMIT to confirm:
--   SELECT key, body FROM site_content
--     WHERE key IN ('company_phone', 'company_business_hours', 'company_address');
--   -- should return three rows
-- ============================================================
