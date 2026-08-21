-- Adds the fields needed for the admin "Email Campaign" (coupon-broadcast)
-- feature: a marketing-consent flag on customers (there was no such field
-- before this -- account creation captures no explicit marketing opt-in
-- today, confirmed via information_schema before writing this) and a
-- send-history log table.
--
-- marketing_opt_in defaults true (an opt-out model) rather than false,
-- since there's no existing signup-time consent checkbox to have set it
-- explicitly -- CAN-SPAM permits this for commercial email as long as
-- opt-outs are honored (see routes/marketing.js's one-click unsubscribe,
-- which flips this to false). This is a real compliance gap worth
-- closing properly later: add an explicit opt-in checkbox to account
-- creation and default new signups off that instead of this column's
-- default, and consider whether any non-US customers need an opt-in
-- (not opt-out) default for GDPR/CASL reasons -- both out of scope for
-- this migration, flagged here for whoever revisits it.
--
-- email_campaigns is a send-history log (one row per SEND, not per
-- recipient) -- deliberately separate from scheduled_emails (the older
-- Promo tab's pending-job queue, with no coupon/recipient-count/sent-by
-- concept, and whose "Send Now" path never logs anything at all) and
-- from coupon_redemptions (a real per-checkout redemption record --
-- sending a campaign email must NOT write one of those; only an actual
-- redemption at checkout does).
--
-- Schema confirmed live via psql against forgewell_db before writing this.
--
-- Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f marketing-opt-in-migration.sql

BEGIN;

ALTER TABLE customers
  ADD COLUMN marketing_opt_in boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN customers.marketing_opt_in IS
  'Whether this customer may receive marketing/broadcast email (coupon campaigns, etc.) -- transactional email (order confirmations, shipping updates) is unaffected and always sends regardless of this flag. Flipped to false by the one-click unsubscribe link every campaign email carries (routes/marketing.js).';

CREATE TABLE email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  body text NOT NULL,
  coupon_code text NOT NULL,
  recipient_count integer NOT NULL,
  sent_by text REFERENCES admin_users(id),
  sent_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE email_campaigns IS
  'Send-history log for the admin Email Campaign feature (Coupons tab) -- one row per send, not per recipient. Sending a campaign never creates a coupon_redemptions row; that table is for real checkout-time redemptions only.';

COMMIT;

-- ============================================================
-- Verification queries -- run after COMMIT to confirm:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'customers' AND column_name = 'marketing_opt_in';
--   -- should return one row
--   SELECT to_regclass('email_campaigns');
--   -- should return 'email_campaigns', not null
-- ============================================================
