/* Keep the existing flashcard and report statistics on the same card catalog.
   Card IDs, review dates, and mastery rules remain owned by the existing SRS. */
(function () {
  'use strict';
  if (window.__vaFlashStatsInstalled || typeof srsScopeItems !== 'function' || typeof repData !== 'function') return;
  window.__vaFlashStatsInstalled = true;

  var originalScopeItems = srsScopeItems;
  srsScopeItems = function () {
    var items = [], seen = Object.create(null);
    function add(item) {
      if (!seen[item.id]) { seen[item.id] = true; items.push(item); }
    }
    originalScopeItems.apply(this, arguments).forEach(add);
    var lids = deckLessonIdxs();
    if (typeof VA_CLOZE !== 'undefined') VA_CLOZE.forEach(function (card) {
      if (lids.indexOf(card.lid) >= 0) add({ id: card.cardId });
    });
    // Do not use siClozeItems(): in due mode it omits future cards, which
    // would incorrectly remove those cards from the total and mastery counts.
    return items;
  };

  var originalReportData = repData;
  repData = function () {
    var data = originalReportData.apply(this, arguments);
    var today = srsDateStr(0), seen = Object.create(null);
    var counts = { math: 0, english: 0, science: 0, history: 0 }, total = 0;
    function add(id, subject) {
      if (seen[id] || !Object.prototype.hasOwnProperty.call(counts, subject)) return;
      seen[id] = true;
      var state = srsState[id];
      if (state && state.reviews > 0 && srsIsDue(state, today)) {
        counts[subject]++; total++;
      }
    }
    // Next-step recommendations cover every subject, independently of the
    // active flashcard scope. Recompute once so future upstream additions
    // cannot cause the extra vocabulary or cloze cards to be counted twice.
    LESSONS.forEach(function (lesson, lid) {
      lesson.v.forEach(function (_, vid) { add(lid + '_' + vid, lesson.s); });
    });
    if (typeof EXTRA_VOCAB !== 'undefined') EXTRA_VOCAB.forEach(function (card, vid) {
      add('x' + vid, card.s);
    });
    if (typeof VA_CLOZE !== 'undefined') VA_CLOZE.forEach(function (card) {
      var lesson = LESSONS[card.lid];
      if (lesson) add(card.cardId, lesson.s);
    });
    data.dueBySubj = counts;
    data.dueReviewedTotal = total;
    data.topDueSubj = repArgmax(counts, ['math', 'english', 'science', 'history']);
    return data;
  };

  function refreshInitialStats() {
    if (typeof renderSrsMeta === 'function') renderSrsMeta();
  }
  if (document.readyState === 'complete') refreshInitialStats();
  else window.addEventListener('load', refreshInitialStats, { once: true });
})();
