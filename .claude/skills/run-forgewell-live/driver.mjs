#!/usr/bin/env node
// Playwright driver for browser-testing forgewell-live -- a LIVE
// PRODUCTION site (https://forgewellpeptide.com), not a local dev
// server. There is nothing to build or launch; every scenario here
// just drives a real headless browser against the real site.
//
// Usage: node driver.mjs <scenario>
//   smoke               -- fills the checkout form, screenshots, does
//                           NOT submit. Safe, no real data created.
//   error-route-demo    -- intercepts the shipping-rates API to force
//                           an error state, screenshots the UI. Safe.
//   double-click        -- fires a real rapid double-click on "Place
//                           Order". CREATES A REAL ORDER + PayRam
//                           charge. Requires CONFIRM_REAL_ORDER=1.
//   checkout-submit     -- single real submit. CREATES A REAL ORDER +
//                           PayRam charge. Requires CONFIRM_REAL_ORDER=1.
//
// See SKILL.md for the full explanation of each scenario and the
// gotchas this file works around.
import { chromium } from 'playwright';

const BASE = 'https://forgewellpeptide.com';
const TEST_EMAIL = 'support@forgewellpeptide.com'; // internally-monitored test mailbox
const SCREENSHOT_DIR = new URL('./screenshots/', import.meta.url).pathname;

async function launch() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  return { browser, page };
}

// forgewell_cart shape per CLAUDE.md: array of { productId, name,
// price, qty }. Seeded via addInitScript so it's present before the
// TARGET page's own script runs -- must be registered before the
// first goto(). Navigating through an intermediate page first (e.g.
// home.html) and setting it via page.evaluate() after that load is
// unreliable -- see the home.html/shop.html gotcha in SKILL.md.
async function seedCart(page, items) {
  await page.addInitScript((cartItems) => {
    localStorage.setItem('forgewell_cart', JSON.stringify(cartItems));
  }, items);
}

async function fillCheckoutAddress(page) {
  await page.fill('#checkout-email-input', TEST_EMAIL);
  await page.fill('#checkout-ship-name', 'Jane Doe');
  await page.fill('#checkout-ship-line1', '123 Main St');
  await page.fill('#checkout-ship-city', 'Denver');
  await page.selectOption('#checkout-ship-state', 'CO');
  await page.fill('#checkout-ship-zip', '80202');
  // #checkout-ship-country is a plain text input, already defaults to "US".
}

async function screenshot(page, name) {
  const fs = await import('node:fs/promises');
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  const path = `${SCREENSHOT_DIR}${name}.png`;
  await page.screenshot({ path });
  console.log('Screenshot saved:', path);
}

// ---- Scenarios ----

async function scenarioSmoke() {
  const { browser, page } = await launch();
  await seedCart(page, [{ productId: 'nad-plus', name: 'NAD+', price: 35, qty: 1 }]);
  // Navigate DIRECTLY to checkout.html -- not via home.html/shop.html
  // (see the login-gate gotcha in SKILL.md).
  await page.goto(`${BASE}/checkout.html`, { waitUntil: 'domcontentloaded' });
  await fillCheckoutAddress(page);
  await page.waitForSelector('#shipping-standard-list input[name="shipping-method"]', { timeout: 20000 });
  await page.check('#shipping-standard-list input[name="shipping-method"]');
  await screenshot(page, 'smoke-checkout-filled');
  console.log('Smoke test complete -- form filled, rates loaded, NOT submitted. No real order created.');
  await browser.close();
}

async function scenarioErrorRouteDemo() {
  const { browser, page } = await launch();
  await seedCart(page, [{ productId: 'nad-plus', name: 'NAD+', price: 35, qty: 1 }]);
  // Route interception -- forces the shipping-rates call to fail
  // without touching the real backend, to exercise the page's own
  // error-state UI (showShippingRatesError() -- see checkout.html).
  await page.route('**/api/shipping/rates', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Simulated failure' }) })
  );
  await page.goto(`${BASE}/checkout.html`, { waitUntil: 'domcontentloaded' });
  await fillCheckoutAddress(page);
  await page.waitForTimeout(2000); // let the debounced rate fetch fire and fail
  await screenshot(page, 'error-route-demo');
  const placeOrderDisabled = await page.$eval('#checkout-place-order-btn', (el) => el.disabled);
  console.log('Place Order button disabled after simulated rate-fetch failure:', placeOrderDisabled);
  await browser.close();
}

async function scenarioDoubleClick() {
  if (process.env.CONFIRM_REAL_ORDER !== '1') {
    console.error('Refusing to run: this creates a REAL order + PayRam charge on production. Set CONFIRM_REAL_ORDER=1 to proceed.');
    process.exit(1);
  }
  const { browser, page } = await launch();
  const checkoutPosts = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/api/checkout')) checkoutPosts.push(req.url());
  });
  await seedCart(page, [{ productId: 'nad-plus', name: 'NAD+', price: 35, qty: 1 }]);
  await page.goto(`${BASE}/checkout.html`, { waitUntil: 'domcontentloaded' });
  await fillCheckoutAddress(page);
  await page.waitForSelector('#shipping-standard-list input[name="shipping-method"]', { timeout: 20000 });
  await page.check('#shipping-standard-list input[name="shipping-method"]');

  const clickResult = await page.evaluate(() => {
    const btn = document.getElementById('checkout-place-order-btn');
    const before = btn.disabled;
    btn.click();
    const afterFirst = btn.disabled;
    btn.click();
    return { before, afterFirst };
  });
  await page.waitForTimeout(6000);
  console.log(JSON.stringify({ clickResult, checkoutPostCount: checkoutPosts.length, finalUrl: page.url() }, null, 2));
  await screenshot(page, 'double-click-result');
  await browser.close();
}

async function scenarioCheckoutSubmit() {
  if (process.env.CONFIRM_REAL_ORDER !== '1') {
    console.error('Refusing to run: this creates a REAL order + PayRam charge on production. Set CONFIRM_REAL_ORDER=1 to proceed.');
    process.exit(1);
  }
  const { browser, page } = await launch();
  await seedCart(page, [{ productId: 'nad-plus', name: 'NAD+', price: 35, qty: 1 }]);
  await page.goto(`${BASE}/checkout.html`, { waitUntil: 'domcontentloaded' });
  await fillCheckoutAddress(page);
  await page.waitForSelector('#shipping-standard-list input[name="shipping-method"]', { timeout: 20000 });
  await page.check('#shipping-standard-list input[name="shipping-method"]');
  await page.click('#checkout-place-order-btn');
  await page.waitForTimeout(6000);
  console.log('Final URL (should be a pay.forgewellpeptide.com payment link):', page.url());
  await screenshot(page, 'checkout-submit-result');
  await browser.close();
}

const scenarios = {
  smoke: scenarioSmoke,
  'error-route-demo': scenarioErrorRouteDemo,
  'double-click': scenarioDoubleClick,
  'checkout-submit': scenarioCheckoutSubmit,
};

const name = process.argv[2];
if (!scenarios[name]) {
  console.error('Usage: node driver.mjs <' + Object.keys(scenarios).join('|') + '>');
  process.exit(1);
}
scenarios[name]().catch((err) => {
  console.error('Driver scenario failed:', err);
  process.exit(1);
});
