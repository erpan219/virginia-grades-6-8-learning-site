/* Display order is separate from canonical option IDs used by grades and saves.
   Seeds belong to attempts, never languages or render calls. Seedless historical
   attempts intentionally retain their original order. */
(function (root) {
  'use strict';
  function seed() {
    var bytes = new Uint32Array(2);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(bytes);
    else { bytes[0] = Math.random() * 0x100000000; bytes[1] = Math.random() * 0x100000000; }
    return bytes[0].toString(36) + '-' + bytes[1].toString(36);
  }
  function order(count, attemptSeed, key) {
    var ids = Array.from({ length: count }, function (_, i) { return i; });
    if (typeof attemptSeed !== 'string' || !attemptSeed) return ids;
    var text = attemptSeed + ':' + String(key), state = 2166136261;
    for (var k = 0; k < text.length; k++) state = Math.imul(state ^ text.charCodeAt(k), 16777619);
    state >>>= 0;
    function random() {
      state = (state + 0x6D2B79F5) >>> 0;
      var t = Math.imul(state ^ (state >>> 15), state | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    for (var i = ids.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1)), swap = ids[i];
      ids[i] = ids[j]; ids[j] = swap;
    }
    return ids;
  }
  root.vaChoiceSeed = seed;
  root.vaChoiceOrder = order;
})(typeof window === 'undefined' ? globalThis : window);
