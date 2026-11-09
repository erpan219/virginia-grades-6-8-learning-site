/* Refresh the initial flashcard after the later cloze extension joins the deck.
   This does not rebuild/shuffle the deck or change any review schedule. */
(function () {
  function refreshInitialCard() {
    if (typeof showFlash === 'function') showFlash(false);
  }
  if (document.readyState === 'complete') refreshInitialCard();
  else window.addEventListener('load', refreshInitialCard, { once: true });
})();
