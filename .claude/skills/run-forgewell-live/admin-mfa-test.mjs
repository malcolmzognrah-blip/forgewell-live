// Standalone Playwright test for admin.html's post-password MFA code-entry
// flow -- not part of driver.mjs's checkout-focused scenarios, so this is
// its own script. Loads the static file directly (no server needed) and
// mocks every backend call via page.route(), matching the real backend's
// exact response shapes (including status codes) so this genuinely
// exercises the same gap the original bug lived in.
import { chromium } from 'playwright';

// Served via a plain `python3 -m http.server` on the repo root (started
// separately) rather than loaded as file:// -- fetch() against a
// file://-origin page resolves a relative '/api/admin/login' to another
// file:// URL, which page.route()'s network-layer interception does not
// reliably catch (confirmed: the click handler's fetch never resolved
// through the mock at all when tried this way). A real http:// origin
// matches production's actual scheme and makes route interception behave
// exactly as it does against the live site.
const url = 'http://127.0.0.1:8934/admin.html';

const results = [];
function report(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log((pass ? 'PASS' : 'FAIL') + ' -- ' + name + ': ' + detail);
}

async function getState(page) {
  return page.evaluate(() => {
    function disp(id) {
      const el = document.getElementById(id);
      if (!el) return 'MISSING';
      return getComputedStyle(el).display;
    }
    return {
      loginPasswordStep: disp('login-password-step'),
      loginMfaStep: disp('login-mfa-step'),
      loginWrap: disp('login-wrap'),
      adminWrap: disp('admin-wrap'),
      title: document.getElementById('login-wrap-title') ? document.getElementById('login-wrap-title').textContent : 'MISSING',
      errorText: document.getElementById('admin-login-error') ? document.getElementById('admin-login-error').textContent : 'MISSING',
      errorShown: document.getElementById('admin-login-error') ? document.getElementById('admin-login-error').classList.contains('show') : false,
    };
  });
}

async function main() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));
  page.on('requestfailed', (req) => consoleErrors.push('requestfailed: ' + req.url() + ' -- ' + (req.failure() && req.failure().errorText)));
  page.on('response', (res) => { if (res.status() >= 400) consoleErrors.push('http ' + res.status() + ': ' + res.url()); });

  // Stub Turnstile before the page's own script tag ever loads -- avoids
  // depending on a real Cloudflare challenge, and avoids the real
  // challenges.cloudflare.com script even attempting to load offline.
  await page.addInitScript(() => {
    window.turnstile = { getResponse: () => 'stub-token', reset: () => {}, render: () => {} };
  });
  await page.route('**/challenges.cloudflare.com/**', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));

  // Track how many times admin-wrap ever became visible, sampled on every
  // frame-ish interval during scenario 1's click -- the whole point of
  // that scenario is proving it NEVER does, not even briefly.
  let adminWrapEverVisible = false;
  async function pollAdminWrap(page, ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const visible = await page.evaluate(() => {
        const el = document.getElementById('admin-wrap');
        return el && getComputedStyle(el).display !== 'none';
      });
      if (visible) { adminWrapEverVisible = true; break; }
      await page.waitForTimeout(20);
    }
  }

  // ---- SCENARIO 1 ----
  await page.route('**/api/admin/login', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, mfaRequired: true, pendingToken: 'test-pending-token-abc' }),
    });
  });
  // orders endpoint stubbed defensively for this scenario too -- if the
  // bug were NOT fixed, showAdmin() would trigger loadOrders(), and we
  // want to observe the real 401-driven snap-back behavior, so return a
  // real 401 here, matching what an absent session actually gets.
  await page.route('**/api/admin/orders*', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Not logged in.' }) }));

  await page.goto(url);
  await page.fill('#admin-username-input', 'testadmin');
  await page.fill('#admin-password-input', 'testpassword');

  const pollPromise = pollAdminWrap(page, 1500);
  await page.click('#admin-login-btn');
  await pollPromise;
  await page.waitForTimeout(200); // settle

  const s1 = await getState(page);
  const s1pass = !adminWrapEverVisible
    && s1.loginPasswordStep === 'none'
    && s1.loginMfaStep === 'block'
    && s1.title === 'Verification Code';
  report(
    'Scenario 1: mfaRequired 200 never flashes admin-wrap, switches to code step',
    s1pass,
    'adminWrapEverVisible=' + adminWrapEverVisible + ' loginPasswordStep=' + s1.loginPasswordStep + ' loginMfaStep=' + s1.loginMfaStep + ' title="' + s1.title + '"'
  );

  // ---- SCENARIO 2 ----
  await page.unroute('**/api/admin/login/verify-totp').catch(() => {});
  await page.route('**/api/admin/login/verify-totp', (route) => {
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Invalid code. Please try again.' }),
    });
  });
  await page.fill('#admin-mfa-code-input', '000000');
  await page.click('#admin-mfa-verify-btn');
  await page.waitForTimeout(200);
  const s2 = await getState(page);
  const s2pass = s2.loginMfaStep === 'block' && s2.loginPasswordStep === 'none' && s2.errorShown && s2.errorText.indexOf('Invalid code') !== -1;
  report(
    'Scenario 2: wrong code stays on mfa-step',
    s2pass,
    'loginMfaStep=' + s2.loginMfaStep + ' loginPasswordStep=' + s2.loginPasswordStep + ' errorShown=' + s2.errorShown + ' errorText="' + s2.errorText + '"'
  );

  // ---- SCENARIO 3 ----
  await page.unroute('**/api/admin/login/verify-totp').catch(() => {});
  await page.route('**/api/admin/login/verify-totp', (route) => {
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Your login has expired. Please sign in again.', restart: true }),
    });
  });
  await page.fill('#admin-mfa-code-input', '111111');
  await page.click('#admin-mfa-verify-btn');
  await page.waitForTimeout(200);
  const s3 = await getState(page);
  const s3pass = s3.loginPasswordStep === 'block' && s3.loginMfaStep === 'none' && s3.title === 'Admin Login' && s3.errorShown && s3.errorText.indexOf('expired') !== -1;
  report(
    'Scenario 3: restart:true forces back to password step',
    s3pass,
    'loginPasswordStep=' + s3.loginPasswordStep + ' loginMfaStep=' + s3.loginMfaStep + ' title="' + s3.title + '" errorShown=' + s3.errorShown + ' errorText="' + s3.errorText + '"'
  );

  // ---- SCENARIO 4 ----
  // Back to the mfa-step first (repeat scenario 1's login).
  await page.unroute('**/api/admin/login').catch(() => {});
  await page.route('**/api/admin/login', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, mfaRequired: true, pendingToken: 'test-pending-token-2' }) });
  });
  await page.fill('#admin-username-input', 'testadmin');
  await page.fill('#admin-password-input', 'testpassword');
  await page.click('#admin-login-btn');
  await page.waitForTimeout(200);

  await page.unroute('**/api/admin/login/verify-totp').catch(() => {});
  await page.route('**/api/admin/login/verify-totp', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, username: 'testadmin' }) });
  });
  await page.unroute('**/api/admin/orders*').catch(() => {});
  await page.route('**/api/admin/orders*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
  // initLiveChat() (also called from showAdmin()) touches socket.io --
  // stub that request path too so it doesn't hang/error the page.
  await page.route('**/socket.io/**', (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }));

  await page.fill('#admin-mfa-code-input', '222222');
  await page.click('#admin-mfa-verify-btn');
  await page.waitForTimeout(300);
  const s4 = await getState(page);
  const s4pass = s4.adminWrap === 'block' && s4.loginWrap === 'none';
  report(
    'Scenario 4: successful verify-totp reaches admin dashboard',
    s4pass,
    'adminWrap=' + s4.adminWrap + ' loginWrap=' + s4.loginWrap
  );

  console.log('\nConsole/page errors seen during run:');
  if (consoleErrors.length === 0) {
    console.log('  none');
  } else {
    consoleErrors.forEach((e) => console.log('  ' + e));
  }

  await browser.close();

  const allPass = results.every((r) => r.pass);
  console.log('\n' + (allPass ? 'ALL SCENARIOS PASSED' : 'SOME SCENARIOS FAILED'));
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
