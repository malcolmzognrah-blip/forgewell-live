-- Send-history log for the new admin "Store Credit Campaign" feature
-- (Coupons tab) -- one row per SEND (subject/body/amount/recipient
-- count/sent_by), not per recipient. Deliberately a separate table from
-- email_campaigns (the coupon-campaign feature's own log): that table's
-- coupon_code column is NOT NULL and doesn't apply here, and a store
-- credit campaign's real per-customer effect (the actual credit grant)
-- is already fully covered by store_credit_transactions +
-- admin_audit_log (one row each per recipient, written the exact same
-- way a manual single-customer issuance already is) -- this table is
-- purely the send-level summary, same role email_campaigns plays for
-- coupon campaigns.
--
-- Schema confirmed live via psql against forgewell_db before writing
-- this (site_content/email_campaigns/customers/store_credit_transactions
-- all already existed; this is a genuinely new table).
--
-- Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f store-credit-campaigns-migration.sql

BEGIN;

CREATE TABLE store_credit_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  body text NOT NULL,
  amount_cents integer NOT NULL,
  recipient_count integer NOT NULL,
  sent_by text REFERENCES admin_users(id),
  sent_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE store_credit_campaigns IS
  'Send-history log for the admin Store Credit Campaign feature (Coupons tab) -- one row per send, not per recipient. The actual per-customer credit grant lives in store_credit_transactions (type=''issued'') and admin_audit_log (action=''store_credit.issue''), written identically to a manual single-customer issuance -- this table is purely the send-level summary.';

COMMIT;

-- ============================================================
-- Verification query -- run after COMMIT to confirm:
--   SELECT to_regclass('store_credit_campaigns');
--   -- should return 'store_credit_campaigns', not null
-- ============================================================
