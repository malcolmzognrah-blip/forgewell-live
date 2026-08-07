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
`shipping.html`, `ruo-agreement.html`, `contact.html`, `why-us.html`, `coa.html`, `faqs.html`,
`about-us.html`, `cart.html`, and `checkout.html`, the header (logo, seven `.header-nav-link`s —
Home, Products, Why Us?, COA, FAQs, About Us, Contact Us — search, login-icon/cart-icon/hamburger,
all in a single row), the hamburger's `#nav-overlay` dropdown menu, and the footer are all fetched
at runtime from `/header.html` and `/footer.html` and injected into
`<div id="header-placeholder">` / `<div id="footer-placeholder">`. Each of those pages calls this loader
near the top of its trailing `<script>` block:
```js
Promise.all([
  fetch('/header.html').then(r => r.text()).then(html => { document.getElementById('header-placeholder').innerHTML = html; }),
  fetch('/footer.html').then(r => r.text()).then(html => { document.getElementById('footer-placeholder').innerHTML = html; })
]).then(wireHeaderFooter);
```
**All header/footer DOM wiring (hamburger toggle, login-icon session check, header/footer search
inputs, footer email-signup) lives inside `wireHeaderFooter()`**, duplicated verbatim in each of those
16 pages, and is only invoked from that `.then()` — never at top-level script-parse time. The
`.cart-icon` is a plain `<a href="/cart.html">` now (see Checkout flow below) so it needs no click
wiring of its own. If you add new header/footer interactivity, it must go inside
`wireHeaderFooter()` (in every one of the 16 pages) rather than as a top-level statement, or it will
silently no-op (or throw, for unguarded lookups) because the fragment hasn't loaded yet when the
script runs. `updateCartIcon()` is also called at the end of `wireHeaderFooter()` for the same reason
— the header's `.cart-icon` doesn't exist yet the first time the page tries to restore the cart count
from `localStorage`.

`admin.html`/`order-confirmation.html` were deliberately left out of this — they have a different,
simpler header (or none) and no footer at all, so pointing them at `header.html`/`footer.html` would
add UI they don't currently have, not just dedupe markup.

The header's `.header-nav-links` (all seven links) and `.hamburger` are mutually exclusive via a single
`@media (max-width: 1050px)` rule in each page's own `<style>` block — links inline in the row above
that width, hidden below it with the hamburger (and `#nav-overlay`, same seven links) taking over.
1050px isn't arbitrary: fitting seven links plus logo/search/icons on one line needs real room, and
this was tuned by measuring the actual rendered width rather than guessed — forcing the links to stay
visible below that point was verified to squeeze `.header-search-row` down to an unusable size well
before anything visibly overlaps. `.header-search-row` itself is intentionally small (`max-width:240px` by default, shrinking further
at the 1050px and 420px tiers) to leave room for all seven links.
Below 420px, `.login-icon-label`/`.cart-icon-label` ("Sign In"/"Cart" text) drop to `display:none`
(icon-only) — without that, those two labels alone are enough to squeeze the search box into visibly
overlapping the login icon on narrow phones. The visible label reads "Products" but the link (in both
the row and the dropdown) still points at `/shop.html` — don't grep for "Shop" expecting to find it.

Cart state logic (`addToCart`/`saveCart`/`updateCartIcon`) is still duplicated inline on all 16 pages
with no shared `.js` file. **A fix or feature to that logic must be manually re-applied to every page
that has a copy of it**, or the pages will silently drift out of sync. Grep for the function/variable
name across `*.html` before assuming a single-file edit is sufficient. Rendering the cart's contents
(`renderCartPage`, `updateCartQty`, `removeFromCart`, `calculateCartDiscount`) is `cart.html`'s job
exclusively — the other 14 non-checkout pages only add to the cart and update the header badge; they
no longer render cart contents themselves (there used to be a `renderCart()`/`buildCartPanel()` pair
duplicated on every page for a slide-out panel — removed when `cart.html` was introduced). Collecting
contact/shipping info and calling `/api/checkout` is `checkout.html`'s job exclusively — that used to
be a duplicated `getCheckoutInfo()` + `#checkout-email-overlay` modal on every page (opened by both
`cart.html`'s checkout button and a product card's "Buy Now"); both now just add to the cart (if
needed) and navigate to `/checkout.html` instead. `calculateCartDiscount` is duplicated in both
`cart.html` and `checkout.html` since each renders its own order-total preview independently — see
Checkout flow below.

### Product pages are rendered dynamically

`shop.html` fetches the live catalog from `GET /api/products` and renders cards into `#grid`
(category tabs + pagination). `home.html` does its own separate `GET /api/products` fetch and renders
a fixed top-8 selection into `#most-popular-grid` (a horizontal-scroll list, no pagination/filtering).
Both pages render `.card` markup via the same `buildCardHtml()` function, duplicated in each file per
the no-shared-JS rule above. Clicking a card navigates to `/product.html?id=<productId>`, which
re-fetches `/api/products`, finds the matching product client-side, and renders it into
`#product-root`. The header search box's "jump to product" feature on all 16 pages that embed the
shared header (see above) also routes to `/product.html?id=<productId>` against the same live
catalog. The 20 legacy pre-rendered `forgewell-product-<slug>.html` pages and the `PRODUCT_PAGE_MAP`
object that used to route search to them have been removed — `product.html` is now the only
per-product page.

### Client-side state is localStorage, not cookies

- `forgewell_cart` — JSON array of `{ productId, name, price, qty }` (no image field — `cart.html`
  looks up each item's image by matching `productId` against a live `GET /api/products` fetch instead).
  Written by `addToCart`/`saveCart` on every page with the cart script block; rendered only by
  `cart.html`'s `renderCartPage()`; read (and cleared on a successful order) by `checkout.html`.
- `forgewell_checkout_email`, `forgewell_shipping_address` — collected on `checkout.html`'s own page-level
  form (not a modal — see Checkout flow), saved right before the `/api/checkout` POST, and reused to
  autofill the form on a future visit.
- `forgewell_last_order_id` — set right before redirecting to the payment provider's `paymentUrl`, read by
  `order-confirmation.html`.

Session/auth state (`/api/auth/me`, `/api/admin/me`) is **cookie-based** (`credentials: 'include'` on every
fetch) — separate from the localStorage cart state. Customer auth (`/api/auth/*`) and admin auth
(`/api/admin/*`) are independent sessions; `admin.html` never touches `/api/auth/*`.

### Checkout flow

Both the cart and checkout are dedicated pages — `cart.html` and `checkout.html` — not panels or
modals. The header's `.cart-icon` is a plain `<a href="/cart.html">` (in `header.html`) with no
click-handler JS of its own. There used to be a JS-built `<div id="cart-panel">`
(`buildCartPanel()`/`renderCart()`) that the cart-icon opened, and a JS-built `#checkout-email-overlay`
modal (`getCheckoutInfo()`) that both the cart and a card's "Buy Now" opened for contact/shipping
info — both were duplicated on every page and are gone now. `cart.html` and `checkout.html` follow the
same shared-header/footer pattern as the other 14 pages, but `cart.html` is the only one that renders
cart *contents* (see previous section) and `checkout.html` is the only one with the contact/shipping
form and shipping-method selector. The hamburger dropdown's links (same seven as `.header-nav-links` —
see the header section above) still don't include a cart or checkout entry, since the header row's
cart icon already covers it.

Every "buy" entry point now converges on `checkout.html`: `cart.html`'s "Proceed to Checkout" button,
a product card's "Buy Now" button (`home.html`/`shop.html`), and `product.html`'s own dedicated
"Buy Now" button all just add to the cart if needed (skipped for `cart.html`, which already has
items) and `window.location.href = '/checkout.html'` — no more per-entry-point modal or direct
`/api/checkout` call. This is a real behavior change for card-level Buy Now: it used to check out only
that one item, ignoring whatever else was in the cart; now it adds the item to the cart and checks out
the whole cart.

`checkout.html` redirects to `/cart.html` immediately if `forgewell_cart` is empty (nothing to check
out). It shows the same contact/shipping fields the old modal had (email, full name, address line 1,
line 2 optional, city, state, zip, country — defaults to `US`), autofilled from
`forgewell_checkout_email`/`forgewell_shipping_address` with the same validation rules as before, plus
a shipping-method radio group (`SHIPPING_METHODS` — USPS Flat Rate $11.99, UPS/FedEx Ground $14.99,
UPS/FedEx 2nd Day Air $21.99) that recalculates the displayed order total live on change. **That total
is a client-side preview only** — same caveat as the existing bulk/cart discount preview
(`calculateCartDiscount`): the external backend "recalculates the real charge from scratch," and
today's `/api/checkout` POST body is unchanged (`{ items: [{ productId, qty }], customerEmail,
shippingAddress }` — no shipping method included), so there's no guarantee the shown total matches
what's actually charged. On success (`payment.paymentUrl` present) the cart is cleared and the browser
redirects to the external hosted payment page, same as before.

### Images

Product images live in `images/` and are referenced as `images/<name>.png`. `resolveImagePath()`
(duplicated in `product.html`, `shop.html`, `home.html`, and `cart.html` — the pages that render an
actual product image, as opposed to just a product name/price) treats a path starting with `http` as
absolute, one starting with `/` as already site-rooted, and everything else gets a leading `/`
prepended (paths come from the product DB as `images/foo.png`, relative to site root).

### Certificate of Analysis (COA) PDFs

`coa/` holds one PDF per product, named `<product.id>.pdf` — the same `id` already used in that
product's own URL (`/product.html?id=<productId>`). There's no manifest or database entry to keep in
sync: `product.html`'s `checkCoaExists()` does a `HEAD /coa/<id>.pdf` request on page load and treats
any non-200 or network error as "no PDF," so a product with no file there just shows nothing — never a
broken link. This was a deliberate choice over a manifest file specifically to avoid a second thing
that could drift out of sync with what's actually in the folder; dropping in a correctly-named PDF is
the whole workflow.

When a PDF exists, `wireCoaLink()` does two things: it reveals `#gallery-thumbs` (CSS for this already
existed, unused, before this feature) with two thumbnails — the vial photo (`data-role="image-thumb"`,
clickable, swaps `#gallery-main-img`'s `src`; this generalizes if a product ever gets more than one
photo) and a document-icon thumbnail that opens the PDF via a plain `target="_blank"` link, no JS
needed for that part — and it also points the pre-existing (previously dead, `href="#"`) "View
Certificate of Analysis" link near the Buy buttons at the same PDF. Both start hidden in the initial
render and only appear once `checkCoaExists()` resolves true; with no COA, the gallery looks exactly
like it did before this feature (single image, no thumbnail row).

### Backup files

`shop.html.backup`, `shop.html.backup2`, `shop.html.backup-20260804` are snapshots left in the repo root —
not served, not linked, not part of the live site. Don't edit them as if they were live pages.
