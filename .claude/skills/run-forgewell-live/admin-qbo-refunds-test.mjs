// Standalone Playwright test for admin.html's QuickBooks transaction
// list + refund form (Payments tab -> QuickBooks sub-tab). Separate file
// per this session's own precedent (admin-mfa-test.mjs / admin-mfa-
// settings-test.mjs) -- each test file stays scoped to one feature.
// Served via a plain http server (file:// doesn't reliably support
// page.route() interception -- see admin-mfa-test.mjs's own comment),
// mocks every backend call, never touches a real backend/production data.
import { chromium } from 'playwright';

const url = 'http://127.0.0.1:8934/admin.html';

const results = [];
function report(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log((pass ? 'PASS' : 'FAIL') + ' -- ' + name + ': ' + detail);
}

async function main() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const issues = [];
  page.on('pageerror', (err) => issues.push('pageerror: ' + err.message));

  await page.addInitScript(() => {
    window.turnstile = { getResponse: () => 'stub-token', reset: () => {}, render: () => {} };
  });
  await page.route('**/challenges.cloudflare.com/**', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route('**/api/admin/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, username: 'testadmin' }) }));
  await page.route('**/socket.io/**', (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: '' }));
  await page.route('**/api/admin/quickbooks/status', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: true, realmId: '123', environment: 'production' }) }));
  // Default /orders (Orders tab + PayRam tab's own eager loads) -- empty,
  // not the focus of this test.
  await page.route('**/api/admin/orders', (route) => {
    if (route.request().url().includes('paymentMethod=card')) return; // handled per-scenario below
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  const fakeOrders = [
    { id: 'order-1', order_number: 'FW-1001', customer_email: 'alice@example.com', total: 50.00, status: 'paid', created_at: '2026-09-10T12:00:00Z', reference_id: 'ref-abc123', payment_method: 'card' },
    { id: 'order-2', order_number: 'FW-1002', customer_email: 'bob@example.com', total: 20.00, status: 'refunded', created_at: '2026-09-11T12:00:00Z', reference_id: 'ref-def456', payment_method: 'card' },
    { id: 'order-3', order_number: 'FW-1003', customer_email: 'carol@example.com', total: 15.00, status: 'pending_payment', created_at: '2026-09-12T12:00:00Z', reference_id: null, payment_method: 'card' },
  ];

  let lastOrdersRequestUrl = null;
  await page.route('**/api/admin/orders?**', (route) => {
    lastOrdersRequestUrl = route.request().url();
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeOrders) });
  });

  await page.goto(url);
  await page.waitForSelector('#admin-wrap', { state: 'visible' });
  await page.click('#tab-payments');
  await page.waitForTimeout(300);
  await page.click('#payments-subtab-quickbooks');
  await page.waitForTimeout(100);

  // ---- Scenario 1: list loads, paymentMethod=card sent, 3 rows, order-3 has no toggle ----
  const s1 = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#qbo-transactions-tbody tr[data-order-id]:not(.product-detail-row)'));
    return {
      rowCount: rows.length,
      resultCountText: document.getElementById('qbo-result-count').textContent,
      order3HasToggle: !!document.querySelector('.qbo-detail-toggle-btn[data-order-id="order-3"]'),
    };
  });
  const s1Pass = lastOrdersRequestUrl && lastOrdersRequestUrl.includes('paymentMethod=card') && s1.rowCount === 3 && !s1.order3HasToggle;
  report('Scenario 1: list loads with paymentMethod=card, 3 rows, no-reference-id row has no toggle', s1Pass, 'url=' + lastOrdersRequestUrl + ' rowCount=' + s1.rowCount + ' resultCountText="' + s1.resultCountText + '" order3HasToggle=' + s1.order3HasToggle);

  // ---- Scenario 2: expand order-1 (eligible, partial remaining) -- Intuit detail + local history + form pre-filled ----
  const detailResponse1 = {
    order: { id: 'order-1', order_number: 'FW-1001', total: 50.00, status: 'paid', payment_method: 'card', reference_id: 'ref-abc123' },
    refunds: [{ id: 'r1', amount: 10.00, description: 'Partial refund', intuit_refund_id: 'intuit-r1', intuit_type: 'REFUND', status: 'ISSUED', created_at: '2026-09-15T10:00:00Z' }],
    totalRefunded: 10.00,
    remainingBalance: 40.00,
    intuitDetail: {
      status: 'CAPTURED',
      card: { number: 'xxxxxxxxxxxx4242', cardType: 'Visa', name: 'Alice Test', expMonth: '08', expYear: '2029', address: { streetAddress: '123 Main St', city: 'Denver', region: 'CO', country: 'US', postalCode: '80202' } },
      refundDetail: [{ id: 'intuit-r1', status: 'ISSUED', amount: 10.00, type: 'REFUND', created: '2026-09-15T10:00:00Z' }],
    },
  };
  await page.route('**/api/admin/orders/order-1/refunds', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detailResponse1) }));

  await page.click('.qbo-detail-toggle-btn[data-order-id="order-1"]');
  await page.waitForTimeout(300);

  const s2 = await page.evaluate(() => {
    const cell = document.getElementById('qbo-detail-cell-order-1');
    const amountInput = cell.querySelector('.qbo-refund-amount-input');
    return {
      hasDegradedNote: !!cell.querySelector('.qbo-degraded-note'),
      cellText: cell.textContent,
      amountValue: amountInput ? amountInput.value : null,
      amountMax: amountInput ? amountInput.getAttribute('max') : null,
      hasIneligibleNote: !!cell.querySelector('.qbo-ineligible-note'),
    };
  });
  const s2Pass = !s2.hasDegradedNote && !s2.hasIneligibleNote && s2.amountValue === '40.00' && s2.amountMax === '40.00' &&
    s2.cellText.includes('Visa') && s2.cellText.includes('xxxxxxxxxxxx4242') && s2.cellText.includes('08/2029') && s2.cellText.includes('Denver') &&
    s2.cellText.includes('Partial refund') && s2.cellText.includes('Total Refunded') && s2.cellText.includes('40.00');
  report('Scenario 2: expand shows Intuit detail + local history + form pre-filled with remaining balance', s2Pass, JSON.stringify(s2).slice(0, 300));

  // ---- Scenario 3: idempotency key stable across two submits of the same expand, changes on re-expand ----
  const submittedKeys = [];
  await page.route('**/api/admin/orders/order-1/refund', (route) => {
    const body = JSON.parse(route.request().postData());
    submittedKeys.push(body.idempotencyKey);
    route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Simulated rejection for retry test.' }) });
  });

  await page.fill('.qbo-refund-amount-input[data-order-id="order-1"]', '5.00');
  await page.click('.qbo-refund-submit-btn[data-order-id="order-1"]');
  await page.waitForTimeout(200);
  await page.click('.qbo-refund-submit-btn[data-order-id="order-1"]'); // retry, same form instance
  await page.waitForTimeout(200);

  const stableKeyPass = submittedKeys.length === 2 && submittedKeys[0] === submittedKeys[1] && !!submittedKeys[0];
  report('Scenario 3a: idempotencyKey stable across two submits of the same expand', stableKeyPass, 'keys=' + JSON.stringify(submittedKeys));

  // Collapse and re-expand -- should fetch again and get a NEW key on next submit.
  await page.click('.qbo-detail-toggle-btn[data-order-id="order-1"]'); // collapse
  await page.waitForTimeout(100);
  await page.click('.qbo-detail-toggle-btn[data-order-id="order-1"]'); // re-expand -> re-fetch -> new key
  await page.waitForTimeout(300);
  await page.fill('.qbo-refund-amount-input[data-order-id="order-1"]', '5.00');
  await page.click('.qbo-refund-submit-btn[data-order-id="order-1"]');
  await page.waitForTimeout(200);

  const rotatedKeyPass = submittedKeys.length === 3 && submittedKeys[2] !== submittedKeys[0];
  report('Scenario 3b: idempotencyKey rotates after collapse + re-expand', rotatedKeyPass, 'keys=' + JSON.stringify(submittedKeys));

  // ---- Scenario 4: ineligible order (already fully refunded, remainingBalance 0) ----
  const detailResponse2 = {
    order: { id: 'order-2', order_number: 'FW-1002', total: 20.00, status: 'refunded', payment_method: 'card', reference_id: 'ref-def456' },
    refunds: [{ id: 'r2', amount: 20.00, description: null, intuit_refund_id: 'intuit-r2', intuit_type: 'REFUND', status: 'ISSUED', created_at: '2026-09-15T11:00:00Z' }],
    totalRefunded: 20.00,
    remainingBalance: 0,
    intuitDetail: null, // also exercises the degraded-state note
  };
  await page.route('**/api/admin/orders/order-2/refunds', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detailResponse2) }));
  await page.click('.qbo-detail-toggle-btn[data-order-id="order-2"]');
  await page.waitForTimeout(300);

  const s4 = await page.evaluate(() => {
    const cell = document.getElementById('qbo-detail-cell-order-2');
    return {
      hasDegradedNote: !!cell.querySelector('.qbo-degraded-note'),
      hasIneligibleNote: !!cell.querySelector('.qbo-ineligible-note'),
      ineligibleText: cell.querySelector('.qbo-ineligible-note') ? cell.querySelector('.qbo-ineligible-note').textContent : null,
      hasForm: !!cell.querySelector('.qbo-refund-amount-input'),
    };
  });
  const s4Pass = s4.hasDegradedNote && s4.hasIneligibleNote && !s4.hasForm && s4.ineligibleText.includes('already been fully refunded');
  report('Scenario 4: fully-refunded order shows degraded note + ineligible note, no form', s4Pass, JSON.stringify(s4));

  // ---- Scenario 5: successful refund updates status pill + history without collapsing the row ----
  await page.unroute('**/api/admin/orders/order-1/refund').catch(() => {});
  await page.route('**/api/admin/orders/order-1/refund', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, intuitRefundId: 'intuit-r-new', status: 'ISSUED', type: 'REFUND', amount: 5.00, remainingBalance: 35.00 }),
  }));
  const detailResponseAfter = {
    order: { id: 'order-1', order_number: 'FW-1001', total: 50.00, status: 'paid', payment_method: 'card', reference_id: 'ref-abc123' },
    refunds: [
      { id: 'r1', amount: 10.00, description: 'Partial refund', intuit_refund_id: 'intuit-r1', intuit_type: 'REFUND', status: 'ISSUED', created_at: '2026-09-15T10:00:00Z' },
      { id: 'r3', amount: 5.00, description: null, intuit_refund_id: 'intuit-r-new', intuit_type: 'REFUND', status: 'ISSUED', created_at: '2026-09-17T10:00:00Z' },
    ],
    totalRefunded: 15.00,
    remainingBalance: 35.00,
    intuitDetail: { status: 'CAPTURED', card: { number: 'xxxxxxxxxxxx4242', cardType: 'Visa', name: 'Alice Test' }, refundDetail: [] },
  };
  await page.unroute('**/api/admin/orders/order-1/refunds').catch(() => {});
  await page.route('**/api/admin/orders/order-1/refunds', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detailResponseAfter) }));

  await page.fill('.qbo-refund-amount-input[data-order-id="order-1"]', '5.00');
  await page.click('.qbo-refund-submit-btn[data-order-id="order-1"]');
  await page.waitForTimeout(300);

  const s5 = await page.evaluate(() => {
    const detailRow = document.querySelector('.product-detail-row[data-order-id="order-1"]');
    const cell = document.getElementById('qbo-detail-cell-order-1');
    return {
      rowStillExpanded: detailRow.classList.contains('show'),
      cellText: cell.textContent,
    };
  });
  const s5Pass = s5.rowStillExpanded && s5.cellText.includes('35.00') && s5.cellText.includes('intuit-r-new');
  report('Scenario 5: successful refund refreshes detail in place, row stays expanded', s5Pass, 'rowStillExpanded=' + s5.rowStillExpanded + ' has35=' + s5.cellText.includes('35.00'));

  console.log('\nUnexpected page errors:');
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
