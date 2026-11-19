/* Old-browser notice. A classic (non-module) script written in old JavaScript, so that it runs even where the app's
   modules cannot. The app needs the features below (see docs/browser-compat.md; on iPhone this means iOS 15.4 or
   later). Without them it shows a plain message instead of a half-working screen. It reads and sends nothing. */
(function () {
  var w = window, missing = [];
  if (typeof w.structuredClone !== 'function') missing.push('structuredClone');
  if (!(w.crypto && typeof w.crypto.randomUUID === 'function' && w.crypto.subtle)) missing.push('crypto');
  if (typeof Array.prototype.at !== 'function') missing.push('Array.at');
  if (!w.indexedDB) missing.push('indexedDB');
  if (!('noModule' in w.document.createElement('script'))) missing.push('modules');
  w.__shredCompat = { ok: missing.length === 0, missing: missing };
  if (!missing.length) return;
  function show() {
    var d = w.document.createElement('div');
    d.className = 'too-old'; d.setAttribute('role', 'alert');
    d.textContent = 'This browser is too old to run Shred by QK. On iPhone or iPad, update to iOS 15.4 or later. Otherwise, use a current version of Chrome, Edge, Firefox, Safari or Samsung Internet. Nothing has been saved or sent.';
    w.document.body.insertBefore(d, w.document.body.firstChild);
  }
  if (w.document.body) show(); else w.document.addEventListener('DOMContentLoaded', show);
})();
