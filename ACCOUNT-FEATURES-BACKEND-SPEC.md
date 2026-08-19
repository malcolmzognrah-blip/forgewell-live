# Backend spec: account.html (Addresses, Security, Coupons, Store Credit)

`account.html`, `admin.html`, and `checkout.html` in this repo are already wired against the
endpoints below. Everything marked **NEW** doesn't exist in the backend yet — the frontend calls
it, gets a 404/error today, and degrades to an empty/loading state rather than crashing. Nothing
here is live until these are implemented. The backend lives outside this repo, so this is a
handoff spec, not a diff.

All endpoints are cookie-session-authenticated (`credentials: 'include'`) exactly like the
existing `/api/auth/*` and `/api/addresses` routes — customer-scoped ones from the customer
session, `/api/admin/*` ones from the admin session.

---

## 1. Addresses (mostly existing — two gaps)

`GET/POST/DELETE /api/addresses` already exist and already work. Two things `account.html`'s new
Addresses tab needs that aren't exercised anywhere today:

- **`PUT /api/addresses/:id`** (NEW) — same body shape as `POST /api/addresses`
  (`label, name, line1, line2, city, state, zip, country`), plus `is_default` (see below). Used
  both for editing an existing address and for the "Set as Default" action (sends the full address
  back with `is_default: true`).
- **`is_default` field** (NEW) — a boolean per address. When an address is created/updated with
  `is_default: true`, the backend should clear the flag on every other address belonging to that
  customer, so exactly one (or zero) is ever default at a time. `GET /api/addresses` should include
  this field in each returned address so the UI can show a "Default" badge.

## 2. Account Details / Security (all new)

- **`PATCH /api/auth/me`** (NEW) — body `{ name, email }`. Updates the signed-in customer's profile.
  Should validate email uniqueness/format the same way signup does.
- **`POST /api/auth/change-password`** (NEW) — body `{ currentPassword, newPassword }`. For accounts
  that already have a password. Verify `currentPassword` before setting `newPassword`.
- **`POST /api/auth/set-password`** (NEW) — body `{ newPassword }`. For Google-linked accounts with
  no password yet — no current-password check, since there isn't one.
- **`GET /api/auth/me` needs a new `hasPassword` boolean field** in its response. This is how the
  frontend decides which of the two forms above to show. Until this field exists, `account.html`
  assumes `hasPassword: true` for everyone (today's behavior, unchanged) — see the comment next to
  `renderPasswordSection()` in `account.html`.

## 3. Coupons (new system)

Replaces the single hardcoded `FORGE15` check inside `POST /api/checkout`'s `discountCode` handling.

**Schema:**

```
coupons
  code                 text primary key (or unique)      -- e.g. 'FORGE15'
  discount_type        text                              -- 'percent' | 'fixed'
  discount_value       numeric                            -- 15 (=15%) or 10.00 (=$10)
  active               boolean default true
  expires_at           timestamp, nullable
  per_customer_limit   integer default 1                  -- redemptions per customer, not global
  created_at           timestamp

coupon_redemptions
  id                   uuid primary key
  coupon_code          text references coupons(code)
  customer_id          uuid references customers(id)
  order_id             uuid references orders(id)
  redeemed_at           timestamp
```

**Customer-facing:**
- **`GET /api/coupons/mine`** (NEW) — returns every active coupon (not expired), each annotated with
  this customer's status against it: `{ code, discountType, discountValue, expiresAt, status: 'available' | 'redeemed' }`.
  `status` is `'redeemed'` once the customer has hit `per_customer_limit` redemptions for that code.

**Admin:**
- **`GET /api/admin/coupons`** (NEW) — all coupons plus a `redemption_count` (total redemptions across
  all customers, for the admin table).
- **`POST /api/admin/coupons`** (NEW) — body `{ code, discount_type, discount_value, expires_at, per_customer_limit }`.
- **`PATCH /api/admin/coupons/:code`** (NEW) — currently only used to toggle `{ active }` from
  `admin.html`'s Coupons tab, but no reason to restrict it to that field.

**Checkout integration:**
- `POST /api/checkout`'s existing `discountCode` validation (already returns a 400 with an
  error message containing "promo code" on failure — `checkout.html` already special-cases that
  string match) needs to move from the current hardcoded check to querying `coupons` +
  `coupon_redemptions`.
- **Redemption timing (superseded from an earlier version of this spec):** the `coupon_redemptions`
  row is inserted only once payment actually succeeds (the webhook handler, on the same
  `status = 'FILLED' | 'OVER_FILLED'` path that flips `orders.status` to `'paid'`) — not at order
  creation. `POST /api/checkout` just decides which coupon (if any) wins against the bulk discount
  and stores its code on the new `orders.coupon_code` column (see
  `coupon-redemption-on-payment-migration.sql`); the earlier version of this spec had the insert
  happening inside the order-creation transaction, which meant merely applying a coupon at checkout
  burned the customer's single use of it even if they abandoned the cart or payment failed.
  `coupon_redemptions`' own `UNIQUE(email, code)` constraint is what stops the same code from ever
  being credited to more than one order, including the case where two never-completed orders both
  had it applied and both later happen to get paid — whichever webhook lands first wins the
  redemption row; the second is caught (Postgres error `23505`) and logged, not thrown, so that
  order still correctly ends up `paid` either way.

## 4. Store Credit (new system)

**Schema** — a ledger, not a single mutable balance column, so the balance is always derivable and
every issuance/redemption is independently auditable:

```
store_credit_transactions
  id                   uuid primary key
  customer_id          uuid references customers(id)
  amount_cents         integer                    -- always positive; type below carries the sign
  type                 text                        -- 'issued' | 'redeemed'
  reason               text, nullable              -- e.g. 'Refund for order #1234', admin free-text
  order_id             uuid references orders(id), nullable   -- set when type='redeemed' (which order it paid toward)
  created_by_admin_id  uuid, nullable               -- set when type='issued' via the admin panel
  created_at           timestamp
```

Balance for a customer = `sum(amount_cents where type='issued') - sum(amount_cents where type='redeemed')`.

**Customer-facing:**
- **`GET /api/store-credit/mine`** (NEW) — `{ balanceCents, transactions: [{ id, amountCents, type, reason, createdAt, orderId }] }`.

**Admin** — note `admin.html` has no customer list/search anywhere today, so this is also new surface area:
- **`GET /api/admin/customers?search=<query>`** (NEW) — searches by email (and name, if convenient).
  Returns `[{ id, email, name }]`. Used only for the Store Credit tab's customer picker right now.
- **`GET /api/admin/store-credit/:customerId`** (NEW) — same shape as the customer-facing endpoint,
  for a given customer, viewed by an admin.
- **`POST /api/admin/store-credit/issue`** (NEW) — body `{ customerId, amountCents, reason }`. Inserts
  a `type: 'issued'` transaction row. This is the only issuance path — there's no "deduct" admin
  action, since redemption should only ever happen through checkout below.

**Checkout integration:**
- `POST /api/checkout` gains a new optional `storeCreditCents` param — the amount the customer
  *wants* to apply (sent as their full current balance from `checkout.html`, see its own comment on
  this). The backend must independently:
  1. Look up the real signed-in customer from the session cookie (**not** trust `customerEmail` from
     the body — this is why `checkout.html`'s fetch now sends `credentials: 'include'`, which it
     didn't before this feature).
  2. Cap the applied amount to `min(requested, customer's real balance, order total)`.
  3. Insert a `type: 'redeemed'` transaction for the amount actually applied, with `order_id` set.
  4. Reduce the charged total by that amount before generating the PayRam payment link.

## 5. Payments tab — no backend changes needed

Investigated as part of this feature: the only payment-adjacent data currently exposed to the
frontend (`GET /api/checkout/:orderId`, used by `order-confirmation.html`) has no payment-method
fields at all — no card, no wallet, nothing. Circumstantial evidence (a dedicated `pay.` subdomain,
the "PayRam" name, and that this category of merchant commonly uses crypto processors) suggests
PayRam may be a crypto gateway rather than a card processor, in which case "masked card" data may
not exist to expose regardless. `account.html`'s Payments tab ships today as a simple per-order
payment-status list built entirely from `GET /api/orders/mine`, which already has everything it
needs — **no new endpoint required**. Revisit only if/when there's an actual payment-method field
worth surfacing.
