/**
 * Inline landing-page pixel, served from GET /pixel.js.
 *
 * Site snippet:
 *   <script src="https://go.<domain>/pixel.js" data-tgp="<slug>" async></script>
 *
 * Plain ES5, no dependencies. Sends beacons to <script origin>/px as
 * text/plain JSON (CORS-safelisted -> no preflight for sendBeacon).
 */
export const PIXEL_SCRIPT = `(function () {
  try {
    var script = document.currentScript;
    if (!script) {
      var all = document.getElementsByTagName('script');
      for (var i = all.length - 1; i >= 0; i--) {
        if (all[i].getAttribute('data-tgp')) { script = all[i]; break; }
      }
    }
    if (!script) return;
    var slug = script.getAttribute('data-tgp');
    var srcMatch = (script.src || '').match(/^https?:\\/\\/[^\\/]+/);
    if (!slug || !srcMatch) return;
    var origin = srcMatch[0];

    function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

    // Stable visitor id (survives page navigation on the same site)
    var cid = load('_tgp_cid');
    if (!cid) {
      cid = '';
      for (var j = 0; j < 16; j++) cid += Math.floor(Math.random() * 16).toString(16);
      store('_tgp_cid', cid);
    }

    function qs(name) {
      var m = location.search.match(new RegExp('[?&]' + name + '=([^&]*)'));
      if (!m) return '';
      try { return decodeURIComponent(m[1].replace(/\\+/g, ' ')); } catch (e) { return m[1]; }
    }

    var utm = { source: qs('utm_source'), medium: qs('utm_medium'), campaign: qs('utm_campaign') };

    // Ad-platform click ids: keep them in localStorage so they survive
    // navigation between landing pages before the go-link click.
    var ID_KEYS = ['yclid', 'gclid', 'fbclid', 'ttclid'];
    var ids = {};
    var hasFresh = false;
    for (var k = 0; k < ID_KEYS.length; k++) {
      var v = qs(ID_KEYS[k]);
      if (v) { ids[ID_KEYS[k]] = v; hasFresh = true; }
    }
    var storedIds = load('_tgp_ids');
    if (storedIds) {
      try {
        var parsed = JSON.parse(storedIds);
        for (var key in parsed) {
          if (parsed.hasOwnProperty(key) && !ids[key]) ids[key] = parsed[key];
        }
      } catch (e) {}
    }
    if (hasFresh) store('_tgp_ids', JSON.stringify(ids));

    function send(type) {
      var payload = JSON.stringify({
        k: slug,
        cid: cid,
        t: type,
        url: location.href,
        ref: document.referrer,
        utm: utm,
        ids: ids
      });
      var sent = false;
      if (navigator.sendBeacon) {
        try { sent = navigator.sendBeacon(origin + '/px', payload); } catch (e) {}
      }
      if (!sent && window.fetch) {
        fetch(origin + '/px', {
          method: 'POST',
          body: payload,
          keepalive: true,
          headers: { 'Content-Type': 'text/plain' }
        })['catch'](function () {});
      }
    }

    send('pv');

    // Delegated click tracking: our go-links and any t.me links
    document.addEventListener('click', function (ev) {
      var el = ev.target;
      while (el && el !== document && !(el.tagName && el.tagName.toUpperCase() === 'A')) {
        el = el.parentNode;
      }
      if (!el || !el.tagName || el.tagName.toUpperCase() !== 'A' || !el.href) return;
      var href = el.href;
      var isGo = href.indexOf('/l/' + slug) !== -1;
      var isTg = href.indexOf('t.me/') !== -1;
      if (!isGo && !isTg) return;
      // Stitch the visitor id onto our redirect so the Click row gets clientId
      if (isGo && href.indexOf('cid=') === -1) {
        el.href = href + (href.indexOf('?') === -1 ? '?' : '&') + 'cid=' + cid;
      }
      send('click');
    }, true);
  } catch (e) {}
})();
`;
