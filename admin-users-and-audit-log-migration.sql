-- Replaces the single shared admin password (ADMIN_PASSWORD in .env,
-- checked in routes/admin.js's old POST /login) with real per-person admin
-- accounts, plus an audit trail of who made which change.
--
-- Schema confirmed live via psql against forgewell_db before writing this:
--   - id columns across this DB are consistently `text default
--     gen_random_uuid()::text`, not a native `uuid` column (customers.id,
--     store_credit_transactions.id both confirmed this way) -- matched here
--     rather than trusting ACCOUNT-FEATURES-BACKEND-SPEC.md's draft, which
--     said plain `uuid` and turned out not to match what's actually
--     deployed for either of those tables.
--   - customers.password_hash is `text`, hashed with bcrypt.hash(pw, 12)
--     (routes/auth.js) -- same column name and cost factor reused below,
--     since this is exactly the "existing DB-password lesson learned"
--     referenced in the task (a real bcrypt column already exists
--     elsewhere in this schema to match, not a green-field decision).
--   - No existing table already fits "named login + audit trail" -- this
--     genuinely needs two new tables, not a reuse of something else.
--
-- admin_audit_log.target_id is a plain text column, not a foreign key --
-- deliberately, since a single log spans several target tables with
-- different id types (products.id is a slug, faq_items.id is an integer,
-- coupons' natural key is its code, etc.) and a log entry should survive
-- even if the target row itself is later deleted. admin_audit_log.
-- admin_user_id DOES reference admin_users(id), but ON DELETE SET NULL
-- rather than RESTRICT/CASCADE -- deactivating or removing an admin_users
-- row (see the `active` flag below, the preferred way to retire an
-- account) should never be blocked by, or silently destroy, that person's
-- history in the log.
--
-- Apply with:
--   psql -h localhost -U forgewell -d forgewell_db -f admin-users-and-audit-log-migration.sql

BEGIN;

CREATE TABLE admin_users (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  username       text NOT NULL UNIQUE,
  email          text NOT NULL UNIQUE,
  password_hash  text NOT NULL,
  role           text NOT NULL DEFAULT 'admin',
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_login_at  timestamptz
);

CREATE TABLE admin_audit_log (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_user_id  text REFERENCES admin_users(id) ON DELETE SET NULL,
  action         text NOT NULL,
  target_type    text,
  target_id      text,
  old_value      jsonb,
  new_value      jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log (created_at DESC);
CREATE INDEX idx_admin_audit_log_admin_user_id ON admin_audit_log (admin_user_id);

COMMIT;

-- ============================================================
-- Verification query -- run after COMMIT to confirm:
--   SELECT table_name FROM information_schema.tables
--     WHERE table_name IN ('admin_users', 'admin_audit_log');
--   -- should return both rows
-- ============================================================
--
-- IMPORTANT -- next steps, in this order (see the accompanying handoff
-- notes): create at least one admin_users row with
-- create-admin-user.js BEFORE deploying the new routes/admin.js that
-- requires one to log in at all. Applying this migration alone does not
-- create any admin accounts.
