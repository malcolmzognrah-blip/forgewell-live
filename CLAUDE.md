# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Forgewell is a static, multi-page HTML storefront (peptides/research chemicals e-commerce). There is
**no build system, no package manager, and no test suite** — every page is a plain `.html` file with
its CSS and JS inlined in `<style>`/`<script>` tags. There is no `package.json`, bundler, or linter
configured.

The backend (auth, product catalog, checkout/payment, order storage, admin) lives **outside this repo**
and is consumed purely as a JSON REST API under `/api/*`. Nothing in this repo implements those routes —
treat them as an external contract.

## Commands

- **Preview locally**: serve the directory with any static file server, e.g. `python3 -m http.server 8000`,
  then open `http://localhost:8000/home.html` (marketing landing page) or `http://localhost:8000/shop.html`
  (product catalog). API calls to `/api/*` will fail unless proxied to wherever the real backend is
  running — expect fetches on pages like `home.html`/`shop.html`/`product.html` to error out when
  previewed fully offline.
- **No build, lint, or test commands exist.** Do not invent `npm run` scripts — verify changes by opening
  the page in a browser and exercising the flow manually.

## Architecture

### Every page is (mostly) self-contained — cart/checkout/search logic has no shared JS

`header.html` and `footer.html` are the one exception to the "no shared markup" rule: on
`home.html`, `shop.html`, `product.html`, `login.html`, `orders.html`, `privacy.html`, `terms.html`,
`shipping.html`, `ruo-agreement.html`, `contact.html`, `why-us.html`, `coa.html`, `faqs.html`, and
`about-us.html`, the header (logo, "Home"/"Shop" nav links,
search, login-icon/cart-icon/hamburger — all in a single row), the hamburger's `#nav-overlay` dropdown
menu, and the footer are all fetched at runtime from `/header.html` and `/footer.html` and injected into
`<div id="header-placeholder">` / `<div id="footer-placeholder">`. Each of those pages calls this loader
near the top of its trailing `<script>` block:
```js
Promise.all([
  fetch('/header.html').then(r => r.text()).then(html => { document.getElementById('header-placeholder').innerHTML = html; }),
  fetch('/footer.html').then(r => r.text()).then(html => { document.getElementById('footer-placeholder').innerHTML = html; })
]).then(wireHeaderFooter);
```
**All header/footer DOM wiring (hamburger toggle, login-icon session check, header/footer search
inputs, footer email-signup, the cart-icon's click-to-open-panel) lives inside `wireHeaderFooter()`**,
duplicated verbatim in each of those 14 pages, and is only invoked from that `.then()` — never at
top-level script-parse time. If you add new header/footer interactivity, it must go inside
`wireHeaderFooter()` (in every one of the 14 pages) rather than as a top-level statement, or it will
silently no-op (or throw, for unguarded lookups) because the fragment hasn't loaded yet when the
script runs. `updateCartIcon()` is also called at the end of `wireHeaderFooter()` for the same reason
— the header's `.cart-icon` doesn't exist yet the first time the page tries to restore the cart count
from `localStorage`.

`admin.html`/`order-confirmation.html` were deliberately left out of this — they have a different,
simpler header (or none) and no footer at all, so pointing them at `header.html`/`footer.html` would
add UI they don't currently have, not just dedupe markup.

Cart state logic (`addToCart`/`saveCart`/`renderCart`/`buildCartPanel`) and checkout logic are still
duplicated inline per page with no shared `.js` file. **A fix or feature to that logic must be manually
re-applied to every page that has a copy of it**, or the pages will silently drift out of sync. Grep for
the function/variable name across `*.html` before assuming a single-file edit is sufficient.

### Product pages are rendered dynamically

`shop.html` fetches the live catalog from `GET /api/products` and renders cards into `#grid`
(category tabs + pagination). `home.html` does its own separate `GET /api/products` fetch and renders
a fixed top-8 selection into `#most-popular-grid` (a horizontal-scroll list, no pagination/filtering).
Both pages render `.card` markup via the same `buildCardHtml()` function, duplicated in each file per
the no-shared-JS rule above. Clicking a card navigates to `/product.html?id=<productId>`, which
re-fetches `/api/products`, finds the matching product client-side, and renders it into
`#product-root`. The header search box's "jump to product" feature on all 14 pages that embed the
shared header (see above) also routes to `/product.html?id=<productId>` against the same live
catalog. The 20 legacy pre-rendered `forgewell-product-<slug>.html` pages and the `PRODUCT_PAGE_MAP`
object that used to route search to them have been removed — `product.html` is now the only
per-product page.

### Client-side state is localStorage, not cookies

- `forgewell_cart` — JSON array of `{ productId, name, price, qty }`, read/written by `addToCart`/
  `saveCart`/`renderCart` on every page that has the cart script block.
- `forgewell_checkout_email`, `forgewell_shipping_address` — saved at checkout time and reused on
  subsequent orders.
- `forgewell_last_order_id` — set right before redirecting to the payment provider's `paymentUrl`, read by
  `order-confirmation.html`.

Session/auth state (`/api/auth/me`, `/api/admin/me`) is **cookie-based** (`credentials: 'include'` on every
fetch) — separate from the localStorage cart state. Customer auth (`/api/auth/*`) and admin auth
(`/api/admin/*`) are independent sessions; `admin.html` never touches `/api/auth/*`.

### Checkout flow

Both the cart panel's "Checkout" button and a card's "Buy Now" button POST to `/api/checkout` with
`{ items: [{ productId, qty }], customerEmail, shippingAddress }`. A successful response is expected to
contain `payment.paymentUrl`, and the browser redirects there (an external hosted payment page — no
payment provider SDK is loaded in this repo). There is no dedicated `cart.html` page and no nav element
should ever link to it as a route — the cart itself is a slide-out `<div id="cart-panel">` injected by
`buildCartPanel()`. The header's `.cart-icon` opens that panel via JS (`renderCart()` + setting
`style.right = '0'`) instead of navigating. The hamburger dropdown no longer has its own cart link —
it now links to `why-us.html`, `coa.html`, `faqs.html`, `about-us.html`, and `contact.html` — since
Home/Shop/Cart are already reachable from the main header row.

### Images

Product images live in `images/` and are referenced as `images/<name>.png`. `resolveImagePath()` in
`product.html` treats a path starting with `http` as absolute, one starting with `/` as already
site-rooted, and everything else gets a leading `/` prepended (paths come from the product DB as
`images/foo.png`, relative to site root).

### Backup files

`shop.html.backup`, `shop.html.backup2`, `shop.html.backup-20260804` are snapshots left in the repo root —
not served, not linked, not part of the live site. Don't edit them as if they were live pages.
