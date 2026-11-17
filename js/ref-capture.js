// /js/ref-capture.js -- remembers an affiliate code from an affiliate link
// (?ref=CODE) on ANY storefront page, so it survives the visitor browsing,
// the home/shop login-gate redirect to index.html, and coming back later.
// Loaded in <head> on every storefront page (before home/shop's gate
// script, so the code is stored before that redirect runs). Any change to
// this file must bump ?v= on every include (see CLAUDE.md).
//
// Stored in localStorage as forgewell_referral_code { code, capturedAt }
// (the same key/shape index.html used before this file existed). A code
// older than the admin's attribution window (Affiliate > Settings, fetched
// only while a code is stored, 30 days until then) is dropped.
//
// Used by: index.html (prefills the Sign Up form's affiliate code field;
// cleared after sign-up) and cart.html (prefills the promo code box for a
// signed-in customer who can still use it). The server checks every code
// again (routes/auth.js sign-up, routes/checkout.js).
(function () {
  var KEY = 'forgewell_referral_code';
  var WINDOW_KEY = 'forgewell_referral_window_days';
  var DEFAULT_DAYS = 30;

  function read() {
    try { var raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }
  function windowDays() {
    try {
      var raw = localStorage.getItem(WINDOW_KEY);
      var d = Number(raw);
      return raw !== null && isFinite(d) && d >= 0 ? d : DEFAULT_DAYS;
    } catch (e) { return DEFAULT_DAYS; }
  }

  try {
    var ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && ref.trim()) localStorage.setItem(KEY, JSON.stringify({ code: ref.trim().slice(0, 32), capturedAt: Date.now() }));
  } catch (e) {}

  if (read()) {
    fetch('/api/content/referral-program-settings')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && typeof d.attributionWindowDays === 'number') {
          try { localStorage.setItem(WINDOW_KEY, String(d.attributionWindowDays)); } catch (e) {}
        }
      })
      .catch(function () {});
  }

  window.getStoredReferralCode = function () {
    var p = read();
    if (!p || !p.code || !p.capturedAt) return null;
    if (Date.now() - p.capturedAt > windowDays() * 24 * 60 * 60 * 1000) { clear(); return null; }
    return p.code;
  };
  window.clearStoredReferralCode = clear;
})();
