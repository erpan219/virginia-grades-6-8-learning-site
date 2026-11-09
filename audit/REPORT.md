# Site audit and approved release — November 9, 2026

**Status: reviewed release approved; free account backend deployed and verified.** GitHub is the authoritative source. The owner selected **Erpanelyar@gmail.com's Account**, approved publication, and supplied a dashboard screenshot showing **Workers Free — Active** with **no payment method on file**. No paid services or upgrades were enabled. GitHub Pages publishes from `main` at the repository root; no workflow or hosting-source change is needed.

## Scope and evidence

Live site: https://erpan219.github.io/virginia-grades-6-8-learning-site/

Source baseline: `ac5f562` (latest repository checkout; preceding content commit `4246281`). Changes are on local branch `codex/site-audit-accounts`.

- Live: all 19 routes at **1440 × 900** and **390 × 844**, in English and Simplified Chinese: **76 route/layout checks**. No page-wide horizontal overflow observed. See [live matrix](evidence/live-route-matrix.json).
- Updated local preview: same **76 route/layout checks**, with no page overflow or clipped section/article/filter boundaries. See [local matrix](evidence/local-route-matrix.json).
- All **12 enriched lessons × 2 sizes × 2 languages = 48 lesson checks** opened their existing modal, showed 11 MC items, and stayed within the modal width. See [lesson evidence](evidence/local-enriched-lessons.json).
- Live interactive sampling: completed a 10-question challenge; switched language after answering; flipped/rated flashcards; searched Chinese lesson text; used ratio and slope controls; began, flagged, resumed after reload, reviewed, and submitted a 42-item exam with one test answer; exported the dedicated QA learner profile.
- Local account sampling: parent setup, generated learner code, explicit local-progress import, isolated learner activation, save and restore between separate browser storage origins, concurrent-edit conflict resolution, offline save failure, offline sign-out/recovery, and normal save-and-sign-out. English and Chinese account controls were checked at mobile width. Details below.

Review images: [desktop lessons](evidence/preview-desktop-lessons.png), [mobile lesson](evidence/preview-mobile-lesson.png), [mobile accounts](evidence/preview-mobile-accounts.png), and [Chinese accounts](evidence/preview-chinese-accounts.png). These screenshots are local review artifacts, excluded from Git.

These are desktop browser and emulated mobile viewport checks, not physical iOS/Android or a screen-reader certification. The exam check did not answer every question or wait for the timer to expire. Video playback/caption availability and every lab interaction were not exhaustively tested. No Lighthouse or Core Web Vitals score is claimed.

## Changes within existing views

| Finding | Prepared change |
| --- | --- |
| Dense desktop header takes space from learning | Compact by default, full settings through the existing Menu, measured 62px at desktop default; larger controls remain reachable. |
| Inconsistent reading and action hierarchy | Refined spacing, borders, line height, responsive typography, focus styling and touch targets; retained artwork, brand and navigation. |
| Duplicate symbols in subject filters | Removed the redundant CSS pseudo-icons. |
| Concealed flashcard face stays populated and accessible | Hidden face now has `aria-hidden`, `inert`, and hidden visibility; revealed art remains gated. |
| Initial card count and SRS/report totals omit cloze or extra vocabulary | Initial render refreshed after cloze extension; shared stats include all relevant IDs without changing review dates or mastery rules. Browser test: 545 due → 544 after rating a cloze, total stays 545. |
| Bilingual Bridge removes its own heading while rendering | Preserved the translated Reading & practice heading. |
| Main landmark disappears outside Home | Main role assigned to app shell, nested original main neutralized. |
| Theme choice resets on reload | Persisted device theme; reload verified. |
| Wrong-answer fallback assigns unrelated misconception | Removed lesson-wide misconception fallback; specific choice mappings still apply. |
| Chinese metaphor retry uses simile wording | Corrected translation to a direct metaphor. |
| Three educational explanations need precision | Corrected topic versus main idea, valid division-first equation solving, and simple inheritance versus polygenic eye color. |
| Storage copy promises no accounts/uploads | Account-enabled copy now explains optional accounts and sync; linked profiles show pending/confirmed/error status. Local mode remains available. |

Previously reported challenge-language and slope-control failures did not reproduce on the current live baseline. They are not claimed as newly fixed here.

## Content expansion

No new lesson, page, route, navigation section, game, or lab was added. Existing lessons now contain **12 added explanatory passages, 12 worked examples, 48 MC questions, 24 vocabulary cards, and 96 option-specific distractor explanations**. All additions are English/Simplified Chinese. Existing IDs and answer indexes remain stable.

Totals: **73 lessons, 559 MC questions, 25 TEIs, 545 flashcards** (521 vocabulary + 24 existing cloze).

Enriched lessons: Ratios & Unit Rates; Theme & Main Idea; Scientific Investigation; The American Revolution; Two-Step Equations; Argument & Persuasive Writing; DNA, Genes & Heredity; The Civil Rights Movement; Linear Equations & Slope; Persuasive Techniques & Media Literacy; Chemical Reactions & Conservation of Mass; The Constitution & Branches of Government.

The [content notes](../content/README.md) record sources and checks. Validation covers structure, translations, IDs, options, the added material and selected factual corrections. It is not an expert factual certification of all pre-existing 511 questions. The owner's existing history sequence is preserved.

## Design research

The best fit was the plain, accessible hierarchy used by [USWDS](https://designsystem.digital.gov/components/typography/) and [GOV.UK Frontend](https://github.com/alphagov/govuk-frontend), implemented as small custom CSS changes. [Open Props](https://github.com/argyleink/open-props) was useful as a token-system reference. React-based shadcn/Radix would impose a disproportionate migration on this standalone site. No framework, paid template, font subscription, or copied third-party component was added. See [design notes](../enhancements/design-notes.md).

## Accounts and saved progress

The optional backend uses **Cloudflare Workers Free + D1 Free**, with no email service or paid dependency. It supports one owner-managed household, one parent account, and up to 12 learners. The parent creates usernames with cryptographically generated sign-in codes, can rename/disable learners or reset codes, and has a separate recovery code. Learners cannot access each other's records.

Tokens stay in tab-scoped sessionStorage and are excluded from progress/backup fields. Account data uses dedicated learner namespaces; switching reloads the document because the original storage shim captures its active namespace. Import into an empty account is explicit. Conflicting saves require choosing a copy and do not silently merge or overwrite histories. Offline changes remain local, and an explicit local sign-out parks them outside the normal learner list for later same-account recovery.

The production endpoint is configured through `enhancements/account-config.js` and activates only on the GitHub Pages origin. `scripts/preview.py` injects only the local API for `/accounts-preview`. Deployment instructions and security/cost limits are in [account-service/README.md](../account-service/README.md).

During the real offline test, a local-only Miniflare 5 configuration error was found: the old persistence option was ignored. Disposable QA accounts were lost on the first emulator restart. This was fixed with `resourcePersistencePath`, and a process-restart regression now verifies credentials, sessions, and saved progress survive. No production service or real learner data was affected.

After that fix, the browser test stopped the API, completed a lesson offline, and used local sign-out. After restarting the API, the same parent code signed in successfully, the parked local copy resumed, and the offline lesson saved to the account. A second browser session then restored that progress. Concurrent changes produced a conflict warning; explicitly loading the cloud copy restored the second session's completed lesson and discarded the first session's conflicting local completion as requested. Normal save-and-sign-out removed the account-linked profile from the active learner list and restored the local learner.

## Automated validation

- **17 frontend account tests:** isolation, staged imports/rollback, aliases, credential exclusion, save conflicts, expiry, offline parking/resume, confirmation focus/cancel.
- **10 backend integration tests:** registration, auth/recovery/revocation, ownership, concurrency, validation, CORS/rate limits/caps, actual exported QA snapshot roundtrip, and persistent server restart.
- **6 flashcard regression tests:** scope totals, due/mastered behavior, cloze/extra report counts, no duplicate IDs, initial refresh.
- Content validation passes; **62 executable/lazy-lab script blocks parse**; `git diff --check` passes.
- Worker production build passes with Node 24.22.0. The system default Node 20 is too old for the pinned build CLI; follow the documented supported versions.

Reproduce from repository root:

```sh
node content/build.mjs
python3 scripts/assemble.py
node content/validate.mjs
node scripts/check-scripts.mjs
node --test scripts/tests/flash-stats.mjs enhancements/tests/accounts.test.cjs
```

Run `npm ci`, `npm test`, and `npm run build` in `account-service/` using a supported Node version. Integration tests need permission to bind loopback ports.

## Publication verification and limitations

1. **Complete:** owner reviewed the screenshots/preview and explicitly approved publication on November 9.
2. **Complete:** owner supplied Workers Free evidence with no payment method. The isolated D1 and Worker were created under that account. Free quota exhaustion leaves local learning available.
3. **Complete:** exact bundled Worker passed all 10 backend tests; secrets were created outside Git and installed as secret bindings. Six deployed health/access-control checks passed ([results](evidence/deployed-api-checks.json)). Production users and parent claims remain zero for owner setup. Authenticated save/restore was tested locally, not against a claimed production family.
4. **Complete:** Pages source is `main:/`, HTTPS enforced. [Run 42666622928](https://github.com/erpan219/virginia-grades-6-8-learning-site/actions/runs/42666622928) successfully published commit `c3933e098cba3c9440a788a8d88f4b68e8e7d87f`. The live home shows 559 questions and optional-account copy. The parent setup form was checked at 1440px and 390px in English/Chinese with no horizontal overflow; a real browser invalid-sign-in attempt received the translated credential rejection from the deployed backend. No production account was consumed by testing. Screenshots: [desktop accounts](evidence/published-desktop-accounts.png), [mobile accounts](evidence/published-mobile-accounts.png).

The standalone HTML is approximately **9.4 MB** with embedded assets. This remains the main loading/maintenance concern; the revision avoids a risky framework or asset migration. There is no measured mobile-network performance guarantee. A later approved optimization can separate/cache existing assets without adding sections.

## Approved follow-up: account save wording

The owner requested clearer wording for signed-in learners and approved publication of the tested update. The revision replaces the account profile's generic device-save badge with **Checking account save…**, **Syncing…**, **Saved to your account**, offline/error states, and a newer-save notice. A completed identity check alone cannot produce a saved claim. Server acknowledgement and comparison with current progress are required; edits during asynchronous comparisons remain pending. Local profiles retain device-only wording.

Account-mode help text in onboarding, review/report surfaces, exams, writing/source activities, and backup guidance now refers to account sync and the confirmed save status. Offline recovery and local-storage error explanations are retained. Sign-in still requires opening the learner's account progress to activate syncing.

Validation: **22 frontend account tests pass**, including delayed acknowledgements, failed rechecks, newer remote revisions, and edits during no-op comparisons; **62 scripts parse**. A separate disposable local API on port 8788 and preview on 4174 verified actual progress changing from **Syncing…** to **Saved to your account**. English/Chinese desktop (1440px) and mobile (390px) status labels fit without horizontal overflow. Testing used disposable local accounts; no production learner records were changed. [Preview screenshot](evidence/sync-wording-desktop.png). The owner approved publication through the existing GitHub Pages pipeline; no backend deployment or hosting-plan change is needed.
