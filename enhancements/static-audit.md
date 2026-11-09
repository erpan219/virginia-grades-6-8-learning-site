# Static flow and accessibility audit — 9 November 2026

Scope: existing `index.html` and its 41 decoded JavaScript scripts in `/tmp/va-scripts`. No browser work in this subtask. Parent is verifying live/local behavior independently.

## Confirmed findings and minimal fixes

1. **Main flashcard exposes the concealed meaning to accessibility APIs.** In decoded `08.js`, `showFlash()` (approximately lines 1468–1503) sets `.flipped` and an appropriate button label, but does not make the visually concealed `.flash-face` inert or aria-hidden. Both sides remain populated. Use the already-established lesson-vocabulary pattern (same file, approximately 805–821): set `aria-hidden="true"` and `inert` on the inactive face; remove both on the active face. Run it immediately after the class flip and include hidden attributes on the initial back face. Keep illustration insertion gated until reveal. Verify flip, next, shuffle, rating, language switching, and empty decks.

2. **Bilingual Bridge deletes its own heading.** In decoded `73.js`, initial setup creates `#fxBridgeSettingsH` inside `#fxBridgeSettings` (approximately 494–497); `fxRenderBridgeControls()` then replaces that host's entire `innerHTML` (approximately 479), deleting the heading. This explains the parent-observed route containing only radios. Preserve or recreate the heading for the settings host on every render, while leaving the toolbar control heading unchanged. Existing translation pair: `FX.bridge.settingsHeading`.

3. **Most routed pages have no visible main landmark.** The sole static `main#top` is rehomed inside `#view-home` by `migrate()` in decoded `76.js` (approximately 306–324). `showView()` correctly hides non-current app views, which means the main landmark disappears on every other route. Assign a main role to the active app-view while routing is enabled and set `main#top` to `role="presentation"` during that mode, or use an appShell main landmark with the same nested-main neutralization. Restore original semantics if routing is disabled. Avoid moving/recreating content or resetting state.

4. **Decorative subject markers are unlabelled generated text.** CSS `.tag.math::before`, `.tag.english::before`, `.tag.science::before`, `.tag.history::before`, and the subject filter chip pseudo-elements use `content` strings. This can account for spoken extra subject symbols. Prefer real decorative spans with `aria-hidden="true"` beside the existing accessible subject name, or a supported empty alternative string for generated content. Do not label the entire interactive parent aria-hidden. The source does correctly set hidden on inactive views and includes `.app-view[hidden]{display:none!important}`; static review does **not** establish that hidden routes themselves are exposed. The parent's AX-tool output should be distinguished from a confirmed browser accessibility-tree leak.

## Account integration constraints found in source

- The boot shim fixes the active profile's namespace into a closure for the entire document lifetime. Changing the registry's active ID without reloading would keep subsequent writes mirrored to the old profile. All profile changes must reload.
- `VAProfiles.rawGet/rawSet/rawRem`, `allKeys`, `isLogical`, `readReg`, and `boot` are available. Cloud metadata/session keys must not begin with `va`, because all logical `va*` keys are mirrored into active learner progress.
- Registry format is schemaVersion 1 with `activeProfileId` and `profiles` entries containing `id`/`displayName`; current operations also use revision and journals. Preserve those fields, validate a registry revision before committing, and do not export infra keys as progress.
- Profile namespace data is hydrated into plain logical keys during boot. A cloud profile must be isolated from the user's previous profile and use explicit import rather than silently adopting local progress.

## Static validation

- All 41 decoded scripts passed `node --check`.
- No duplicate static HTML IDs found using Python HTMLParser. Runtime-generated IDs are outside that check.
- One static main landmark exists (`main#top`); no static HTML forms exist. New account controls should use real forms and associated labels.
- These checks do not constitute screen-reader, keyboard, or runtime security verification.
