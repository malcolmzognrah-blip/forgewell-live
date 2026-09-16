// Standalone Playwright test for admin.html's MFA settings panel (enroll
// QR/secret, backup-codes-shown-once, disable) -- separate from
// admin-mfa-test.mjs (which covers the LOGIN-time code-entry step only).
// Served via a plain http server (see admin-mfa-test.mjs's own comment on
// why file:// doesn't reliably support page.route() interception) and
// mocks all four MFA endpoints plus the handful of other calls showAdmin()
// triggers, so this never touches a real backend or Malcolm's real
// account/backup codes.
import { chromium } from 'playwright';

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
    function text(id) {
      const el = document.getElementById(id);
      return el ? el.textContent : 'MISSING';
    }
    return {
      statusLoading: disp('mfa-status-loading'),
      statusError: disp('mfa-status-error'),
      statusDisabled: disp('mfa-status-disabled'),
      statusEnabled: disp('mfa-status-enabled'),
      enrollQrStep: disp('mfa-enroll-qr-step'),
      backupCodesStep: disp('mfa-enroll-backup-codes-step'),
      disableConfirmStep: disp('mfa-disable-confirm-step'),
      enabledSinceText: text('mfa-enabled-since'),
      qrImgSrc: document.getElementById('mfa-enroll-qr-img').getAttribute('src'),
      secretText: text('mfa-enroll-secret-text'),
      enrollErrorText: text('mfa-enroll-status'),
      backupCodesListHtml: document.getElementById('mfa-backup-codes-list').innerHTML,
      doneBtnDisabled: document.getElementById('mfa-backup-codes-done-btn').disabled,
      disableErrorText: text('mfa-disable-status'),
    };
  });
}

async function main() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const issues = [];
  page.on('pageerror', (err) => issues.push('pageerror: ' + err.message));
  page.on('response', (res) => {
    const u = res.url();
    // Expected 4xx from our own deliberate mocks (wrong code / wrong
    // password scenarios below) -- anything else at 400+ is worth seeing.
    if (res.status() >= 400 && !u.includes('/api/admin/mfa/enroll/confirm') && !u.includes('/api/admin/mfa/disable') && !u.includes('/api/admin/me')) {
      issues.push('unexpected http ' + res.status() + ': ' + u);
    }
  });

  await page.addInitScript(() => {
    window.turnstile = { getResponse: () => 'stub-token', reset: () => {}, render: () => {} };
  });
  await page.route('**/challenges.cloudflare.com/**', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));

  // Land directly in the admin dashboard -- GET /api/admin/me (fired on
  // page load) reports an existing session, same as a real returning
  // admin. Not testing the login flow itself here (see admin-mfa-test.mjs).
  await page.route('**/api/admin/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, username: 'testadmin' }) }));
  await page.route('**/api/admin/orders*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
  await page.route('**/socket.io/**', (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }));

  // ---- SCENARIO 1: not enrolled ----
  await page.route('**/api/admin/mfa/status', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: false, enrolledAt: null }) }));

  await page.goto(url);
  await page.waitForSelector('#admin-wrap', { state: 'visible' });
  await page.click('#mfa-settings-toggle-link');
  await page.waitForTimeout(200);

  const s1 = await getState(page);
  const s1pass = s1.statusDisabled === 'block' && s1.statusEnabled === 'none' && s1.statusLoading === 'none' && s1.statusError === 'none';
  report('Scenario 1: not-enrolled state shown', s1pass, 'statusDisabled=' + s1.statusDisabled + ' statusEnabled=' + s1.statusEnabled);

  // ---- SCENARIO 2: enroll -- start, wrong code, then correct code ----
  await page.route('**/api/admin/mfa/enroll/start', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ secret: 'JBSWY3DPEHPK3PXP', qrCodeDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' }),
  }));
  await page.click('#mfa-enable-btn');
  await page.waitForTimeout(200);

  const s2a = await getState(page);
  const s2aPass = s2a.enrollQrStep === 'block' && s2a.qrImgSrc.startsWith('data:image/png;base64,') && s2a.secretText === 'JBSWY3DPEHPK3PXP';
  report('Scenario 2a: enroll/start shows QR + secret', s2aPass, 'enrollQrStep=' + s2a.enrollQrStep + ' qrImgSrc(prefix)=' + s2a.qrImgSrc.slice(0, 22) + ' secretText=' + s2a.secretText);

  // Wrong code -- stays on the same step, shows the error, does NOT call
  // enroll/start again (route below only serves enroll/confirm).
  await page.route('**/api/admin/mfa/enroll/confirm', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid code. Please try again.' }) }));
  await page.fill('#mfa-enroll-code-input', '000000');
  await page.click('#mfa-enroll-confirm-btn');
  await page.waitForTimeout(200);
  const s2b = await getState(page);
  const s2bPass = s2b.enrollQrStep === 'block' && s2b.enrollErrorText.indexOf('Invalid code') !== -1 && s2b.qrImgSrc.startsWith('data:image/png;base64,');
  report('Scenario 2b: wrong code stays on QR step with error, secret/QR still shown', s2bPass, 'enrollQrStep=' + s2b.enrollQrStep + ' enrollErrorText="' + s2b.enrollErrorText + '"');

  // Correct code -- shows backup codes, Done disabled until acknowledged.
  await page.unroute('**/api/admin/mfa/enroll/confirm').catch(() => {});
  const fakeBackupCodes = ['a1b2c3d4e5', 'f6g7h8i9j0', 'k1l2m3n4o5', 'p6q7r8s9t0', 'u1v2w3x4y5', 'z6a7b8c9d0', 'e1f2g3h4i5', 'j6k7l8m9n0', 'o1p2q3r4s5', 't6u7v8w9x0'];
  await page.route('**/api/admin/mfa/enroll/confirm', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, backupCodes: fakeBackupCodes }) }));
  await page.fill('#mfa-enroll-code-input', '123456');
  await page.click('#mfa-enroll-confirm-btn');
  await page.waitForTimeout(200);
  const s2c = await getState(page);
  const allCodesPresent = fakeBackupCodes.every((c) => s2c.backupCodesListHtml.includes(c));
  const s2cPass = s2c.backupCodesStep === 'block' && s2c.enrollQrStep === 'none' && s2c.doneBtnDisabled === true && allCodesPresent;
  report('Scenario 2c: correct code shows all 10 backup codes, Done disabled pre-ack', s2cPass, 'backupCodesStep=' + s2c.backupCodesStep + ' doneBtnDisabled=' + s2c.doneBtnDisabled + ' allCodesPresent=' + allCodesPresent);

  // Done stays disabled/no-op until the checkbox is checked.
  await page.click('#mfa-backup-codes-done-btn', { force: true });
  await page.waitForTimeout(100);
  const s2d = await getState(page);
  const s2dPass = s2d.backupCodesStep === 'block'; // still here -- click on a disabled button should no-op
  report('Scenario 2d: Done click before ack does nothing (still on backup-codes step)', s2dPass, 'backupCodesStep=' + s2d.backupCodesStep);

  await page.check('#mfa-backup-codes-ack-checkbox');
  const doneEnabled = await page.evaluate(() => !document.getElementById('mfa-backup-codes-done-btn').disabled);
  report('Scenario 2e: checking the ack box enables Done', doneEnabled, 'doneBtnDisabled=' + !doneEnabled);

  // ---- SCENARIO 3: Done -> refetches status -> now enrolled ----
  await page.unroute('**/api/admin/mfa/status').catch(() => {});
  await page.route('**/api/admin/mfa/status', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: true, enrolledAt: '2026-09-20T15:30:00.000Z' }) }));
  await page.click('#mfa-backup-codes-done-btn');
  await page.waitForTimeout(200);
  const s3 = await getState(page);
  const s3pass = s3.statusEnabled === 'block' && s3.statusDisabled === 'none' && s3.backupCodesStep === 'none' && s3.enabledSinceText.indexOf('since') !== -1;
  report('Scenario 3: Done refetches status, shows "enabled since"', s3pass, 'statusEnabled=' + s3.statusEnabled + ' enabledSinceText="' + s3.enabledSinceText + '"');

  // ---- SCENARIO 4: disable -- wrong password, then correct password ----
  await page.click('#mfa-disable-start-btn');
  await page.waitForTimeout(100);
  const s4a = await getState(page);
  report('Scenario 4a: Disable MFA shows password-confirm step', s4a.disableConfirmStep === 'block', 'disableConfirmStep=' + s4a.disableConfirmStep);

  // Cancel link, checked here (MFA is still "enabled" at this point) --
  // returns to the status view without ever calling POST /mfa/disable.
  await page.click('#mfa-disable-cancel-link');
  await page.waitForTimeout(200);
  const s4cancel = await getState(page);
  const s4cancelPass = s4cancel.disableConfirmStep === 'none' && s4cancel.statusEnabled === 'block';
  report('Scenario 4-cancel: Cancel returns to status view without disabling', s4cancelPass, 'disableConfirmStep=' + s4cancel.disableConfirmStep + ' statusEnabled=' + s4cancel.statusEnabled);

  // Re-open the confirm step to continue with the actual disable flow.
  await page.click('#mfa-disable-start-btn');
  await page.waitForTimeout(100);

  await page.route('**/api/admin/mfa/disable', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Current password is incorrect.' }) }));
  await page.fill('#mfa-disable-password-input', 'wrongpassword');
  await page.click('#mfa-disable-confirm-btn');
  await page.waitForTimeout(200);
  const s4b = await getState(page);
  const s4bPass = s4b.disableConfirmStep === 'block' && s4b.disableErrorText.indexOf('incorrect') !== -1;
  report('Scenario 4b: wrong password stays on confirm step with error', s4bPass, 'disableConfirmStep=' + s4b.disableConfirmStep + ' disableErrorText="' + s4b.disableErrorText + '"');

  await page.unroute('**/api/admin/mfa/disable').catch(() => {});
  await page.route('**/api/admin/mfa/disable', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
  await page.unroute('**/api/admin/mfa/status').catch(() => {});
  await page.route('**/api/admin/mfa/status', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: false, enrolledAt: null }) }));
  await page.fill('#mfa-disable-password-input', 'correctpassword');
  await page.click('#mfa-disable-confirm-btn');
  await page.waitForTimeout(200);
  const s4c = await getState(page);
  const s4cPass = s4c.statusDisabled === 'block' && s4c.statusEnabled === 'none' && s4c.disableConfirmStep === 'none';
  report('Scenario 4c: correct password disables, refetches status back to not-enabled', s4cPass, 'statusDisabled=' + s4c.statusDisabled + ' statusEnabled=' + s4c.statusEnabled);

  console.log('\nUnexpected console/page/network issues:');
  if (issues.length === 0) console.log('  none');
  else issues.forEach((i) => console.log('  ' + i));

  await browser.close();
  const allPass = results.every((r) => r.pass);
  console.log('\n' + (allPass ? 'ALL SCENARIOS PASSED' : 'SOME SCENARIOS FAILED'));
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
