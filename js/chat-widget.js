// Customer-facing live chat widget -- shared by all 19 customer pages.
// Include at the end of <body>, after the pinned socket.io client:
//
//   <link rel="stylesheet" href="/css/chat-widget.css?v=...">
//   <script src="https://cdn.socket.io/4.8.3/socket.io.min.js"></script>
//   <script src="/js/chat-widget.js?v=..."></script>
//
// Pages carry no chat markup of their own -- it's injected below. Bump the
// ?v= on both includes in every page whenever either file changes.
//
// Opt-in: add data-wait-for-auth to the <script> tag on a page with the
// gw-auth-ok login gate (home.html, shop.html). That page's gate
// (checkSession() at the top of <head>) is asynchronous and
// window.location.replace() doesn't halt script execution -- without the
// wait, io({auth:{guestId}}) would fire the moment this script parses,
// regardless of whether the gate is about to redirect the visitor away for
// having no session at all, silently creating a real chat_conversations row
// server-side for an anonymous visitor who was never actually let onto the
// page. Guest connections aren't rejected server-side (lib/chat.js accepts
// a bare guestId with no session), so the only prevention is to not call
// io() until gw-auth-ok appears -- it's only ever added after a real 200
// from /api/auth/me. Ungated pages omit the attribute and connect eagerly.
(function(){
  // Failed CDN load (network block, ad blocker, CDN outage) means no `io`
  // global -- bail out entirely so the rest of the page is completely
  // unaffected. Checked before the markup is injected, so no inert bubble
  // is left on the page either.
  if (typeof io === 'undefined') return;

  // Read synchronously -- document.currentScript is only set while this
  // script is first executing, not inside the deferred callbacks below.
  var waitForAuth = !!(document.currentScript && document.currentScript.hasAttribute('data-wait-for-auth'));

  var CHAT_WIDGET_MARKUP = [
    '<button type="button" id="chat-widget-bubble" aria-label="Open chat">',
    '  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    '</button>',
    '',
    '<div id="chat-widget-panel">',
    '  <div class="chat-widget-header">',
    '    <span>Chat with us</span>',
    '    <button type="button" id="chat-widget-close-btn">Close</button>',
    '  </div>',
    '  <div id="chat-widget-live">',
    '    <div id="chat-widget-closed-banner">This conversation has ended.</div>',
    '    <div id="chat-widget-messages"></div>',
    '    <div id="chat-widget-error"></div>',
    '    <div id="chat-widget-typing-indicator">Support is typing...</div>',
    '    <div id="chat-widget-guestinfo-form">',
    '      <input type="text" id="chat-widget-guestinfo-name" placeholder="Your name" autocomplete="off" />',
    '      <input type="email" id="chat-widget-guestinfo-email" placeholder="Your email" autocomplete="off" />',
    '      <div id="chat-widget-guestinfo-error"></div>',
    '      <button type="button" id="chat-widget-guestinfo-submit-btn">Continue</button>',
    '    </div>',
    '    <div id="chat-widget-faq-panel">',
    '      <div id="chat-widget-faq-list"></div>',
    '      <div id="chat-widget-faq-feedback">',
    '        <p class="chat-widget-faq-feedback-note">Did this help?</p>',
    '        <div class="chat-widget-faq-feedback-buttons">',
    '          <button type="button" id="chat-widget-faq-yes-btn">Yes</button>',
    '          <button type="button" id="chat-widget-faq-no-btn">No</button>',
    '        </div>',
    '      </div>',
    '    </div>',
    '    <div class="chat-widget-input-row" id="chat-widget-input-row">',
    '      <input type="text" id="chat-widget-input" placeholder="Type a message..." autocomplete="off" />',
    '      <button type="button" id="chat-widget-send-btn">Send</button>',
    '    </div>',
    '  </div>',
    '  <div id="chat-widget-offline">',
    '    <div id="chat-widget-offline-form">',
    '      <p class="chat-widget-offline-note">We\'re offline right now — leave a message and we\'ll get back to you.</p>',
    '      <textarea id="chat-widget-offline-message" placeholder="Type your message..."></textarea>',
    '      <button type="button" id="chat-widget-offline-send-btn">Send</button>',
    '    </div>',
    '    <div id="chat-widget-offline-confirmation">',
    '      <p class="chat-widget-offline-confirmation-text">Thanks! We\'ll be in touch soon.</p>',
    '      <button type="button" id="chat-widget-offline-send-another-btn">Send another message</button>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('\n');

  var mount = document.createElement('div');
  mount.innerHTML = CHAT_WIDGET_MARKUP;
  while (mount.firstChild) document.body.appendChild(mount.firstChild);

  function waitForAuthThenConnect() {
    if (document.documentElement.classList.contains('gw-auth-ok')) {
      connectChatWidget();
    } else {
      setTimeout(waitForAuthThenConnect, 300);
    }
  }

  function connectChatWidget() {
    var GUEST_ID_KEY = 'forgewell_chat_guest_id';
    function getOrCreateGuestId() {
      var id = localStorage.getItem(GUEST_ID_KEY);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(GUEST_ID_KEY, id);
      }
      return id;
    }

    // Server-side identity resolution (lib/chat.js) ignores this guestId
    // outright and uses the real forgewell_session cookie instead whenever
    // one is present and valid -- sent unconditionally here since the
    // client has no reliable way to know in advance which one will win.
    var socket = io({ auth: { guestId: getOrCreateGuestId() } });

    var panel = document.getElementById('chat-widget-panel');
    var bubble = document.getElementById('chat-widget-bubble');
    var messagesEl = document.getElementById('chat-widget-messages');
    var errorEl = document.getElementById('chat-widget-error');
    var input = document.getElementById('chat-widget-input');
    var sendBtn = document.getElementById('chat-widget-send-btn');
    var errorClearTimer = null;
    var closeBtn = document.getElementById('chat-widget-close-btn');
    var closedBannerEl = document.getElementById('chat-widget-closed-banner');
    var typingIndicatorEl = document.getElementById('chat-widget-typing-indicator');
    var typingHideTimer = null;
    var lastTypingEmitAt = 0;

    var liveEl = document.getElementById('chat-widget-live');
    var offlineEl = document.getElementById('chat-widget-offline');
    var offlineFormEl = document.getElementById('chat-widget-offline-form');
    var offlineConfirmationEl = document.getElementById('chat-widget-offline-confirmation');
    var offlineMessageInput = document.getElementById('chat-widget-offline-message');
    var offlineSendBtn = document.getElementById('chat-widget-offline-send-btn');
    var offlineSendAnotherBtn = document.getElementById('chat-widget-offline-send-another-btn');

    var guestinfoFormEl = document.getElementById('chat-widget-guestinfo-form');
    var guestinfoNameInput = document.getElementById('chat-widget-guestinfo-name');
    var guestinfoEmailInput = document.getElementById('chat-widget-guestinfo-email');
    var guestinfoErrorEl = document.getElementById('chat-widget-guestinfo-error');
    var guestinfoSubmitBtn = document.getElementById('chat-widget-guestinfo-submit-btn');
    var inputRowEl = document.getElementById('chat-widget-input-row');

    // Undefined until the first chat:supportStatus arrives (sent right
    // after chat:init on every connection -- see lib/chat.js) -- mode isn't
    // decided until that's been heard at least once, so the opening moment
    // doesn't flash the wrong mode before it's actually known.
    var supportOnline;
    var hasConversationHistory = false;
    var widgetMode = 'live';
    var greetingShown = false;
    // Set from chat:init's own needsGuestInfo field (Stage 1) -- true only
    // for a guest identity missing guest_name/guest_email on the server, per
    // lib/chat.js's connection handler. Checked first in decideMode() below,
    // ahead of the pre-existing live/offline branching, so a brand-new or
    // still-unidentified guest sees this step before anything else
    // regardless of support's online status.
    var needsGuestInfo = false;
    // True only in the narrow window between emitting chat:guestInfo and
    // either a chat:error rejecting it or the next chat:init -- lets the
    // chat:error listener below tell "this error is about the guest-info
    // submission" apart from any other reason the server might emit
    // chat:error, since the payload itself carries no identifying field.
    // Safe to key off this alone: the input row is hidden for the whole
    // window this is true, so nothing else could be triggering a chat:error
    // meanwhile.
    var guestInfoAwaitingResult = false;
    // Guards the welcome bubble setGuestInfoMode() appends below the same
    // way greetingShown guards maybeShowGreeting() -- one-time per
    // connection, not re-fired every time decideMode() re-resolves into
    // this same step (e.g. on a chat:supportStatus flip while the form is
    // still up).
    var guestInfoGreetingShown = false;
    // Reference to the "Thank you..." bubble appended optimistically in
    // submitGuestInfo() below -- kept so the chat:error rollback can remove
    // that one specific element if the submission turns out to have been
    // rejected, rather than leaving a bubble that no longer matches reality
    // sitting in the thread right above the reopened form.
    var guestInfoThankYouEl = null;
    // True from the moment submitGuestInfo() below transitions away from
    // the guest-info form until setLiveMode() actually appends the bubble
    // -- deferred rather than appended immediately, since decideMode()
    // might resolve to the offline form instead if support happens to be
    // offline right then, and appending straight into messagesEl would
    // just hide the bubble the instant setOfflineFormMode() hides liveEl
    // (and messagesEl inside it) along with it.
    var guestInfoThankYouPending = false;

    var faqPanelEl = document.getElementById('chat-widget-faq-panel');
    var faqListEl = document.getElementById('chat-widget-faq-list');
    var faqFeedbackEl = document.getElementById('chat-widget-faq-feedback');
    var faqYesBtn = document.getElementById('chat-widget-faq-yes-btn');
    var faqNoBtn = document.getElementById('chat-widget-faq-no-btn');

    // Tears down both of the FAQ panel's own sub-states (the suggestion
    // list and the "Did this help?" prompt) -- called from the Yes/No
    // handlers below once the panel's job is done, and defensively from
    // every other mode setter (mirroring how they already reset
    // guestinfoFormEl) so a chat:supportStatus/chat:init landing mid-flow
    // can't leave the panel and the input row both visible at once.
    function hideFaqPanel() {
      faqPanelEl.style.display = 'none';
      faqListEl.innerHTML = '';
      faqFeedbackEl.style.display = 'none';
    }

    function setLiveMode() {
      widgetMode = 'live';
      liveEl.style.display = 'flex';
      offlineEl.style.display = 'none';
      guestinfoFormEl.style.display = 'none';
      guestinfoErrorEl.textContent = '';
      hideFaqPanel();
      messagesEl.style.display = 'flex';
      inputRowEl.style.display = 'flex';
      closeBtn.style.display = 'inline-block';
      // Appends the deferred "Thank you..." bubble the first real moment
      // the thread is actually visible -- immediately if support was
      // online at submit time, or later (here) if an offline-form detour
      // came first.
      if (guestInfoThankYouPending) {
        guestInfoThankYouPending = false;
        guestInfoThankYouEl = appendMessage({ senderType: 'admin', body: "Thank you for providing that information! What can we help you with today?" });
      }
    }

    function setOfflineFormMode() {
      widgetMode = 'offlineForm';
      liveEl.style.display = 'none';
      offlineEl.style.display = 'flex';
      offlineFormEl.style.display = 'flex';
      offlineConfirmationEl.style.display = 'none';
      guestinfoFormEl.style.display = 'none';
      guestinfoErrorEl.textContent = '';
      hideFaqPanel();
      closeBtn.style.display = 'none';
    }

    function setOfflineConfirmationMode() {
      widgetMode = 'offlineConfirmation';
      liveEl.style.display = 'none';
      offlineEl.style.display = 'flex';
      offlineFormEl.style.display = 'none';
      offlineConfirmationEl.style.display = 'block';
      guestinfoFormEl.style.display = 'none';
      guestinfoErrorEl.textContent = '';
      hideFaqPanel();
      closeBtn.style.display = 'none';
    }

    // Thread stays visible (unlike the offline modes, which hide liveEl
    // entirely) so the welcome bubble below reads as a real message rather
    // than a note floating above a blank panel -- only the input row is
    // hidden, since there's nothing to send into yet.
    function setGuestInfoMode() {
      widgetMode = 'guestInfo';
      liveEl.style.display = 'flex';
      offlineEl.style.display = 'none';
      inputRowEl.style.display = 'none';
      guestinfoFormEl.style.display = 'flex';
      hideFaqPanel();
      closeBtn.style.display = 'none';
      // Folds B3's greeting into this same bubble rather than showing a
      // separate one -- see the transition back to live mode in
      // submitGuestInfo() below, which sets greetingShown = true so
      // maybeShowGreeting() doesn't also fire once the thread reopens.
      if (!guestInfoGreetingShown) {
        guestInfoGreetingShown = true;
        appendMessage({ senderType: 'admin', body: "Hi! Welcome to Forgewell Support. To get started, please share your name and email so we can assist you." });
      }
    }

    // Re-run on every chat:init (history) and chat:supportStatus (online
    // flag) change. The offline "leave a message" form is specifically for
    // a customer with no conversation history yet -- one who already has a
    // real back-and-forth keeps seeing that thread even if support just
    // went offline. Deliberately NOT called from the offline send handler
    // below: once that form's been submitted, the confirmation screen
    // stays up (not the live thread) until support is back online,
    // regardless of hasConversationHistory now being true from that send.
    function decideMode() {
      if (supportOnline === undefined) return;
      // needsGuestInfo now gates unconditionally -- a guest with no
      // name/email on file resolves that first regardless of support's
      // online status, before ever reaching either the live thread or the
      // offline leave-a-message form. This guarantees widgetMode can never
      // be 'offlineForm'/'offlineConfirmation' while needsGuestInfo is
      // still true, except via the same kind of should-never-happen
      // chat:error rollback race already accepted elsewhere in this file.
      if (needsGuestInfo) { setGuestInfoMode(); return; }
      if (widgetMode === 'offlineConfirmation') {
        if (supportOnline) setLiveMode();
        return;
      }
      if (!supportOnline && !hasConversationHistory) {
        setOfflineFormMode();
      } else {
        setLiveMode();
        maybeShowGreeting();
      }
    }

    function sendOfflineMessage() {
      var body = offlineMessageInput.value;
      if (!body || !body.trim()) return;
      // viaOfflineForm: true tells the server this came from the offline
      // "leave a message" form specifically, not the live thread -- FAQ
      // deflection (lib/chat.js) skips unconditionally for it, matching
      // what this widget actually showed the customer, rather than the
      // server re-checking support's live status at the moment this
      // arrives (which can have moved on since the offline form was shown).
      socket.emit('chat:message', { body: body, viaOfflineForm: true });
      hasConversationHistory = true;
      offlineMessageInput.value = '';
      setOfflineConfirmationMode();
    }

    offlineSendBtn.addEventListener('click', sendOfflineMessage);
    // Back to the leave-a-message form for a new message -- still one-way
    // per send (see decideMode()'s own comment on why this doesn't route
    // through it: the confirmation screen is deliberately not re-derived
    // from live state after an offline send, same reasoning applies to
    // going back the other way here), not a live back-and-forth.
    offlineSendAnotherBtn.addEventListener('click', setOfflineFormMode);
    offlineMessageInput.addEventListener('keydown', function(e){
      // Enter submits, matching the live input's Enter-to-send -- Shift+Enter
      // allows a newline since this is a multi-line textarea, unlike the
      // live path's single-line <input> where Enter always means send.
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendOfflineMessage();
      }
    });

    bubble.addEventListener('click', function(){
      panel.classList.toggle('chat-widget-open');
    });

    closeBtn.addEventListener('click', function(){
      socket.emit('chat:customerClose');
      // Shows the banner immediately rather than waiting on the chat:closed
      // round trip -- same reasoning as the admin presence toggle: this is
      // the customer's own action, nothing a round trip would protect
      // against here.
      closedBannerEl.style.display = 'block';
    });

    function scrollToBottom() {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function appendMessage(msg) {
      var div = document.createElement('div');
      div.className = 'chat-widget-msg chat-widget-msg-' + (msg.senderType === 'admin' ? 'admin' : 'customer');
      div.textContent = msg.body;
      messagesEl.appendChild(div);
      scrollToBottom();
      return div;
    }

    // Purely client-side and ephemeral -- reuses appendMessage() for
    // identical bubble styling, but this text never goes through the
    // socket, is never persisted to chat_messages, and won't appear in an
    // admin's own transcript of this conversation later. greetingShown
    // makes this one-time per connection even though decideMode() (its
    // only call site) can legitimately re-resolve to live mode more than
    // once in a session (e.g. support toggling online/offline/online).
    function maybeShowGreeting() {
      if (greetingShown || hasConversationHistory) return;
      greetingShown = true;
      appendMessage({ senderType: 'admin', body: "Hi there! How can we help you today?" });
    }

    // Renders the suggestion list shown in place of the input row -- one
    // clickable item per match, question text only (the answer is deferred
    // to selectFaqSuggestion() below, once the customer actually picks one).
    function showFaqSuggestions(matches) {
      faqListEl.innerHTML = '';
      matches.forEach(function(match){
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'chat-widget-faq-item';
        item.textContent = match.question;
        item.addEventListener('click', function(){ selectFaqSuggestion(match); });
        faqListEl.appendChild(item);
      });
      faqFeedbackEl.style.display = 'none';
      faqPanelEl.style.display = 'flex';
      inputRowEl.style.display = 'none';
    }

    // Shows the picked answer as a real message bubble -- client-rendered
    // only, same as the welcome/thank-you bubbles above, never sent through
    // the socket (this is the whole point: nothing about a suggestion the
    // customer clicks becomes a persisted chat_messages row). Clears the
    // list rather than leaving it alongside the Did-this-help prompt -- the
    // two are sequential steps within the same panel, not stacked.
    function selectFaqSuggestion(match) {
      appendMessage({ senderType: 'admin', body: match.answer });
      faqListEl.innerHTML = '';
      faqFeedbackEl.style.display = 'flex';
    }

    socket.on('chat:init', function(data){
      messagesEl.innerHTML = '';
      (data.messages || []).forEach(appendMessage);
      hasConversationHistory = (data.messages || []).length > 0;
      needsGuestInfo = !!(data && data.needsGuestInfo);
      guestInfoAwaitingResult = false;
      guestinfoErrorEl.textContent = '';
      decideMode();
    });

    socket.on('chat:supportStatus', function(data){
      supportOnline = !!(data && data.online);
      decideMode();
    });

    // Stays within the live view (no mode switch, unlike offline-mode above)
    // -- the thread and input/send stay fully usable underneath the banner,
    // since sending a new message is exactly how the conversation reopens.
    socket.on('chat:closed', function(){
      closedBannerEl.style.display = 'block';
    });

    socket.on('chat:reopened', function(){
      closedBannerEl.style.display = 'none';
    });

    // Resets the auto-hide timer on every event rather than firing one
    // fixed 3s timeout from the first receipt -- a support agent typing
    // continuously should keep the indicator up the whole time, not have
    // it disappear mid-sentence at the 3s mark.
    socket.on('chat:typing', function(){
      typingIndicatorEl.style.display = 'block';
      clearTimeout(typingHideTimer);
      typingHideTimer = setTimeout(function(){ typingIndicatorEl.style.display = 'none'; }, 3000);
    });

    // Covers both the sender's own echoed message (delivery confirmation)
    // and, once Phase 3 exists, an admin's reply -- same event either way.
    socket.on('chat:message', function(msg){
      hasConversationHistory = true;
      appendMessage(msg);
    });

    // Only ever arrives in reply to the customer's own first send in this
    // conversation (see lib/chat.js's chat:message handler) -- that message
    // was held back server-side rather than persisted, so nothing here
    // needs to reconcile against hasConversationHistory or the thread.
    socket.on('chat:faqSuggestions', function(data){
      showFaqSuggestions((data && data.matches) || []);
    });

    socket.on('chat:error', function(data){
      if (guestInfoAwaitingResult) {
        // Server is the real authority on "required", not just the
        // client-side blank check below -- roll the optimistic reveal in
        // submitGuestInfo() back rather than pretending it succeeded, and
        // show the rejection inline on the form itself (not the generic
        // message-thread error box, since the customer never got as far as
        // the thread).
        guestInfoAwaitingResult = false;
        needsGuestInfo = true;
        // Undoes the greetingShown=true set optimistically in
        // submitGuestInfo() below -- the guest never actually got welcomed
        // (this step is reopening, not completing), so the live thread
        // should still be free to greet them for real once it does complete.
        greetingShown = false;
        // Cancels the deferred append (if the bubble was never actually
        // shown yet -- this rejection racing an offline-form detour) as
        // well as removing it if it already was (the normal online case,
        // where setLiveMode() ran synchronously inside submitGuestInfo()
        // and already appended it before this rejection arrived).
        guestInfoThankYouPending = false;
        if (guestInfoThankYouEl) {
          guestInfoThankYouEl.remove();
          guestInfoThankYouEl = null;
        }
        guestinfoErrorEl.textContent = (data && data.error) || 'Something went wrong. Please try again.';
        guestinfoSubmitBtn.disabled = false;
        decideMode();
        return;
      }
      clearTimeout(errorClearTimer);
      errorEl.textContent = (data && data.error) || 'Something went wrong.';
      errorClearTimer = setTimeout(function(){ errorEl.textContent = ''; }, 4000);
    });

    function submitGuestInfo() {
      // Defensive: with everything below fully synchronous, a second call
      // can't actually land mid-submission today (decideMode() hides the
      // form and blurs its inputs before any second event could be
      // dispatched) -- but this guards the same way if that ever stops
      // being true, at zero cost today.
      if (guestinfoSubmitBtn.disabled) return;

      var name = guestinfoNameInput.value.trim();
      var email = guestinfoEmailInput.value.trim();
      // Basic non-empty check only -- no email-format validation here, since
      // the server (lib/chat.js's chat:guestInfo handler) already rejects a
      // blank name or email and is the real authority on "required" either way.
      if (!name || !email) {
        guestinfoErrorEl.textContent = 'Please enter both your name and email.';
        return;
      }
      guestinfoErrorEl.textContent = '';
      // Disabled only once we're actually committing to submit -- not on
      // the blank-fields rejection above, so the guest can immediately
      // retry without waiting on anything. Blocks a rapid double-click on
      // this same button from re-entering below.
      guestinfoSubmitBtn.disabled = true;
      socket.emit('chat:guestInfo', { name: name, email: email });
      // Optimistic: both fields just passed the same non-empty check the
      // server enforces, so assume success and reveal the thread immediately
      // rather than waiting on a round trip. The chat:error handler above
      // rolls this back in the (should-never-happen) case the server
      // disagrees.
      guestInfoAwaitingResult = true;
      needsGuestInfo = false;
      // The combined welcome+instructions bubble already covered the
      // greeting -- without this, maybeShowGreeting() would fire a second,
      // separate "Hi there! How can we help you today?" the moment
      // decideMode() below resolves back into live mode. Replaced here with
      // a specific thank-you bubble instead of no message at all.
      greetingShown = true;
      guestInfoThankYouPending = true;
      decideMode();
    }

    guestinfoSubmitBtn.addEventListener('click', submitGuestInfo);
    guestinfoNameInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') submitGuestInfo(); });
    guestinfoEmailInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') submitGuestInfo(); });

    faqYesBtn.addEventListener('click', function(){
      socket.emit('chat:faqFeedback', { helpful: true });
      appendMessage({ senderType: 'admin', body: "Glad that helped! Let us know if you need anything else." });
      hideFaqPanel();
      inputRowEl.style.display = 'flex';
      // The server closes the conversation and emits chat:closed to this
      // socket -- the existing chat:closed listener above (B1) shows the
      // "This conversation has ended." banner over the thread exactly as
      // it already does for a customer-initiated close, so nothing more is
      // needed here.
    });

    faqNoBtn.addEventListener('click', function(){
      socket.emit('chat:faqFeedback', { helpful: false });
      hideFaqPanel();
      inputRowEl.style.display = 'flex';
      // The customer's original message arrives shortly via the normal
      // chat:message broadcast once the server actually persists it (see
      // lib/chat.js's chat:faqFeedback handler) -- rendered by the
      // chat:message listener above exactly like any other message, no
      // extra handling needed here.
    });

    function sendMessage() {
      var body = input.value;
      if (!body || !body.trim()) return;
      socket.emit('chat:message', { body: body, viaOfflineForm: false });
      input.value = '';
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', function(e){
      if (e.key === 'Enter') sendMessage();
    });

    // No live thread to type into during offline mode (see decideMode()
    // above) -- input itself is hidden then, but this guard is explicit
    // rather than relying on that alone. Throttled independently of the
    // message rate limit above: this is a cheap relay, not a DB write, but
    // still shouldn't fire on every single keystroke.
    input.addEventListener('keydown', function(){
      if (widgetMode !== 'live') return;
      var now = Date.now();
      if (now - lastTypingEmitAt < 2000) return;
      lastTypingEmitAt = now;
      socket.emit('chat:typing');
    });
  }

  if (waitForAuth) {
    waitForAuthThenConnect();
  } else {
    connectChatWidget();
  }
})();
