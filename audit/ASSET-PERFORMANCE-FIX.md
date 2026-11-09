# Illustration delivery fix — November 9, 2026

The live QA identified 9.4 MB of decoded HTML, 5.43 MB transferred, and a
33.3-second DOMContentLoaded time in one 1.6 Mbps / 4× CPU mobile emulation.
Those are measurements of the previous live version, not field Core Web
Vitals or measurements of this revision.

Source inspection found 200 embedded base64 image occurrences representing
197 distinct images: 140 SVG diagram occurrences and 60 WebP occurrences.
The embedded image URL text alone occupied 5,630,724 bytes. The unique image
files occupy 4,114,324 bytes. Most art was already rendered only when relevant
or carried `loading="lazy"`, but its embedded bytes still travelled in the
initial document. This defeated the network-saving part of lazy loading.

The asset extraction moves those bytes to local, content-addressed URLs and
preserves the original image bytes, IDs, bilingual descriptions, and
answer-side reveal conditions. It removes 5,623,664 bytes from the HTML. A
final assembled HTML comparison against commit `b3e0e5e` is 9,396,112 to
3,331,212 bytes (64.6% smaller). Python gzip compression of those exact files
is 5,411,355 to 1,123,107 bytes. The three separately loaded script files add
343,903 uncompressed bytes. These are file/compression measurements, not a
measured load-time result. Asset requests still consume bandwidth
when their illustrations become relevant, and caching remains subject to the
hosting service's response headers and browser cache state.

The two broken SOL URLs now resolve to existing project art: a tidy study desk
for the introduction and a sprout with blank cards for the result. The exam
renderer uses corrected bilingual descriptions and native dimensions. No
new external provider, subscription, service worker, or personal-data cache
is introduced.

Validation performed by this task:

- Repeated extraction is byte-for-byte idempotent.
- All 197 extracted references resolve and match their filename hashes.
- The output image bytes match their source payloads exactly.
- Nested image payloads in executable base64 scripts are extracted correctly.
- Three asset integrity tests pass, including duplicate-reference deduplication
  and rejection of a corrupt file at a content-addressed path.
- Both SOL files were opened and visually inspected; no text or answer is
  baked into the art.

Integrated browser checks confirmed routes, answer-side flashcard reveal,
and both SOL images. A local bandwidth-limited comparison was attempted, but
the read-only browser interface did not expose the Performance API. No Chrome
DevTools trace MCP was available. This note therefore does not claim a
post-change DOMContentLoaded, LCP, INP, CLS, or interactive-load measurement.

Authoritative implementation references:

- [Chrome/web.dev: native image lazy loading](https://web.dev/articles/browser-level-image-lazy-loading)
  explains that offscreen image requests can be deferred with `loading="lazy"`
  and that visible initial images should remain eager.
- [MDN: HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)
  explains reuse of cached responses and content-specific asset URLs.
