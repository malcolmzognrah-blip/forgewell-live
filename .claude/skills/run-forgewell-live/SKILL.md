---
name: run-forgewell-live
description: Browser-test the forgewell-live storefront (a live production site, no build/dev server) with a real headless Chromium. Use when asked to run, drive, screenshot, or smoke-test forgewellpeptide.com's checkout/shop/product pages, simulate an API error state in the UI, or reproduce a double-click/race-condition bug in a real browser.
---

forgewell-live is a static, no-build multi-page site served in
production at `https://forgewellpeptide.com` (see the repo's
`CLAUDE.md`) — there is no local dev server to launch. "Running" this
project means driving a real headless Chromium (via Playwright)
directly against the live production site. Drive it via
`.claude/skills/run-forgewell-live/driver.mjs`.

All paths below are relative to the repo root.

## Prerequisites

No system packages needed — Playwright's Chromium binary launches
headless with `--no-sandbox` and no extra shared libraries in this
environment. `npx playwright install --with-deps chromium` (the
normally-recommended install) **fails here** — it tries to
`apt-get install` system deps as root and there's no passwordless sudo.
Skip `--with-deps`; the browser-only install works fine (verified this
session).

## Setup

```bash
cd .claude/skills/run-forgewell-live
npm install                       # installs playwright (package.json already declares it)
npx playwright install chromium   # browser binary only -- no --with-deps
```

## Run (agent path)

```bash
cd .claude/skills/run-forgewell-live
node driver.mjs smoke              # safe -- fills the checkout form, does NOT submit
node driver.mjs error-route-demo   # safe -- simulates a shipping-rates API failure
node driver.mjs double-click       # ⚠️ creates a REAL order + PayRam charge -- see below
node driver.mjs checkout-submit    # ⚠️ creates a REAL order + PayRam charge -- see below
```

Screenshots land in `.claude/skills/run-forgewell-live/screenshots/`.

| scenario | what it does | creates real data? |
|---|---|---|
| `smoke` | seeds cart, fills checkout form, waits for real shipping rates, screenshots | no |
| `error-route-demo` | intercepts `/api/shipping/rates` to force a 500, screenshots the resulting disabled-button error state | no |
| `double-click` | fires two native `.click()` calls on Place Order back-to-back, reports how many `/api/checkout` POSTs actually fired | **yes** |
| `checkout-submit` | single real submit through to a PayRam payment link | **yes** |

**`double-click` and `checkout-submit` create a real `pending_payment`
order and a real PayRam charge on production** (visible in PayRam's own
dashboard) — both refuse to run unless `CONFIRM_REAL_ORDER=1` is set:

```bash
CONFIRM_REAL_ORDER=1 node driver.mjs double-click
```

Both use `support@forgewellpeptide.com` (an internally-monitored test
mailbox) as the order email. **After running either, tell the user the
resulting order id/email so they can delete it** — deleting order rows
is a live-data mutation this project's own convention has a human run
via `psql`, not the agent (see `CLAUDE.md`'s deployment/DB notes).

## Test

No test suite exists for this project (static site, no build).

---

## Gotchas

- **`home.html`/`shop.html` now require a logged-in session to even
  render** (added since `CLAUDE.md`'s architecture section was last
  written — this is real, deliberate site behavior, confirmed by
  reading the actual page source, not a bug): both pages open with
  `fetch('/api/auth/me', {credentials:'include'}).then(res => { if
  (!res.ok) window.location.replace('/index.html'); else
  document.documentElement.classList.add('gw-auth-ok'); })` plus
  `<style>html:not(.gw-auth-ok){visibility:hidden;}</style>`. In a
  fresh browser context (no login cookie — the normal case for
  automated testing), this fetch resolves 401 and the page redirects
  itself to `/index.html`, asynchronously, with real network latency.
- **Consequence — a navigation race:** if a test `goto()`s home.html or
  shop.html and then immediately `goto()`s somewhere else (e.g.
  checkout.html) before that pending redirect fires, the two
  navigations race. The page's own delayed redirect to index.html can
  win and hijack the second `goto()` with `net::ERR_ABORTED` on the
  *intended* target — confirmed reproduced this session. **Fix:**
  navigate directly to the target page (checkout.html, product.html,
  cart.html — none of these have the login gate) as the very first
  navigation in the browser context. Don't route through home.html/
  shop.html first unless the test specifically needs to render one of
  them.
- **To actually reach a gated page** (home.html/shop.html) or test a
  signed-in-customer flow, either sign in through index.html's real
  form (`#tab-login`/`#tab-signup`, `#login-email`/`#login-password`,
  submit `#login-submit-btn`) with real test credentials, or get a
  session cookie via `/api/auth/login`/`/api/auth/signup` directly and
  inject it with `context.addCookies()` before navigating.
- **Cart seeding must happen via `addInitScript`, before the first
  `goto()`** — `forgewell_cart` in localStorage is a JSON array of
  `{ productId, name, price, qty }` (see `CLAUDE.md`'s localStorage
  section). Setting it via `page.evaluate()` *after* an initial
  navigation to some other page, then navigating again to the target
  page, is unreliable — same race as above if that first page is
  home.html/shop.html, and just adds an unneeded extra hop otherwise.
  `driver.mjs`'s `seedCart()` shows the working pattern.
- **Real checkout form field IDs** (`checkout.html` — these aren't
  guessable from the label text): `#checkout-email-input`,
  `#checkout-ship-name`, `#checkout-ship-line1`, `#checkout-ship-city`,
  `#checkout-ship-state` (a `<select>` — use `page.selectOption()` with
  a 2-letter code like `"CO"`, not the full state name),
  `#checkout-ship-zip`, `#checkout-ship-country` (plain text input,
  already defaults to `"US"`). Shipping-method radios live under
  `#shipping-standard-list`/`#shipping-fast-list` with
  `name="shipping-method"` and only populate after a real, debounced
  rate-shopping API call — `waitForSelector` on one before `check()`ing
  it, don't assume it's there immediately after filling the address.
  Submit button: `#checkout-place-order-btn`.
- **Route interception for error states** — `page.route('**/api/shipping/rates',
  route => route.fulfill({ status: 500, ... }))`, registered *before*
  `goto()`, forces the shipping-rate-fetch error path
  (`showShippingRatesError()` in checkout.html) without touching the
  real backend. Generalizes to any other endpoint on this site.

## Troubleshooting

- **`net::ERR_ABORTED` navigating to a page right after home.html/shop.html**:
  the login-gate redirect race above. Navigate to the target page
  directly instead.
- **`npx playwright install --with-deps chromium` fails with a sudo
  prompt**: no passwordless sudo in this environment. Drop
  `--with-deps` — the browser binary alone works headless here.
