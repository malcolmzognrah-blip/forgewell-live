// "Notify When In Stock" modal -- shared by product.html, shop.html and
// home.html (the one signup implementation; moved here from product.html).
// Include at the end of <body>:
//
//   <link rel="stylesheet" href="/css/stock-notify.css?v=...">
//   <script src="/js/stock-notify.js?v=..."></script>
//
// Pages carry no modal markup of their own -- it's injected below on first
// use. Bump the ?v= on both includes in every page whenever either file
// changes.
//
// Pages call window.openStockNotify(productId) from their own out-of-stock
// buttons. Pass the id the customer is looking at -- for a kit that's the
// kit's own id, even when it's only out of stock because its backing vial
// is: the signup is stored under the kit, and the backend's job holds the
// email until the kit is actually buyable (vial included).
//
// No login needed -- a guest just gives an email. POSTs
// { productId, email } to /api/stock-notify, which inserts into
// stock_notifications (a repeat signup for the same product + email is a
// no-op).
(function(){
  var NOTIFY_MODAL_MARKUP =
    '<div id="notify-modal">' +
      '<button type="button" id="notify-modal-close" aria-label="Close">&times;</button>' +
      '<div id="notify-modal-step-form">' +
        '<h3>Notify Me</h3>' +
        '<p>We&rsquo;ll email you when this item is back in stock.</p>' +
        '<input type="email" id="notify-modal-input" placeholder="you@example.com">' +
        '<div id="notify-modal-error"></div>' +
        '<button type="button" id="notify-modal-submit">Notify Me</button>' +
      '</div>' +
      '<div id="notify-modal-step-success" style="display:none;">' +
        '<h3>You&rsquo;re All Set</h3>' +
        '<p>We&rsquo;ll email you when this item is back in stock.</p>' +
      '</div>' +
    '</div>';

  var overlay = null;
  var currentProductId = null;

  // Built lazily so pages with nothing out of stock never get the markup.
  function ensureModal() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'notify-modal-overlay';
    overlay.innerHTML = NOTIFY_MODAL_MARKUP;
    document.body.appendChild(overlay);

    var input = document.getElementById('notify-modal-input');
    var error = document.getElementById('notify-modal-error');
    var formStep = document.getElementById('notify-modal-step-form');
    var successStep = document.getElementById('notify-modal-step-success');

    document.getElementById('notify-modal-close').addEventListener('click', function() {
      overlay.classList.remove('active');
    });
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.classList.remove('active');
    });
    document.getElementById('notify-modal-submit').addEventListener('click', function() {
      var email = input.value.trim();
      if (!email || email.indexOf('@') === -1) {
        error.textContent = 'Please enter a valid email address.';
        return;
      }
      error.textContent = '';
      fetch('/api/stock-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: currentProductId, email: email }),
      })
        .then(function(res) {
          return res.json().then(function(data) { return { ok: res.ok, data: data }; });
        })
        .then(function(result) {
          if (!result.ok) {
            error.textContent = result.data.error || 'Something went wrong, please try again.';
            return;
          }
          formStep.style.display = 'none';
          successStep.style.display = '';
        })
        .catch(function() {
          error.textContent = 'Something went wrong, please try again.';
        });
    });
  }

  // A listing page can open this for several different products in one
  // visit, so each open starts back at the form step. The typed email is
  // kept so a second signup doesn't mean retyping it.
  window.openStockNotify = function(productId) {
    ensureModal();
    currentProductId = productId;
    document.getElementById('notify-modal-error').textContent = '';
    document.getElementById('notify-modal-step-form').style.display = '';
    document.getElementById('notify-modal-step-success').style.display = 'none';
    overlay.classList.add('active');
  };
})();
