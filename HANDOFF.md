# Handoff — Virginia Grades 6–8 Learning Site

> If you are an AI agent (or a human collaborator) picking this site up: read this whole file before changing anything. It holds the facts that took months to establish. The owner is Erpan.

## What this is

A bilingual (English / Simplified Chinese) learning site for Virginia grades 6–8, aligned to the Virginia Standards of Learning (SOL). Public link with local learner profiles. Optional parent-managed cloud accounts use the approved Cloudflare Workers Free + D1 Free service.

- **Live site:** https://erpan219.github.io/virginia-grades-6-8-learning-site/
- **Repo:** https://github.com/erpan219/virginia-grades-6-8-learning-site
- **Authoritative source:** this GitHub repository, by explicit owner instruction on November 9, 2026. Muse is historical origin only. Do not replace current GitHub work with a Muse export.

## Architecture — read before editing

- **Standalone frontend.** `index.html` remains the published artifact (~9.4 MB), including embedded assets and the original lesson engine. Maintained additions live in `content/` and `enhancements/`; run `node content/build.mjs` and `python3 scripts/assemble.py` after editing those sources. The assembler is idempotent. The optional API is isolated in `account-service/`.
- **Hash routing, 19 routes**, persistent mounted views, opens on `#/home`. Mobile bottom tab bar: Home · Lessons · Practice · Cards · More. Desktop grouped rail.
- **Local progress remains available.** The optional account service uses Cloudflare Workers Free + D1 Free. It is inactive unless `VA_ACCOUNT_CONFIG.apiBase` is configured. Account-linked sessions use tab-scoped credentials and dedicated local learner namespaces; a profile switch requires reload because the boot shim captures its namespace. Never place credentials in `va*` keys or exports.
- **Content:** 73 lessons (G6: 21, G7: 21, G8: 31 incl. 9 Algebra I), 13 courses, 559 multiple-choice questions + 25 TEIs, 545 flashcards (521 vocab + 24 cloze) in this revision, 22 Play Labs, 7 Three.js 3D lessons, FSRS flashcard scheduling, mistake-review queue, Today's Path, SOL practice exams, mastery map, bilingual glossary (228 terms), printable worksheets + parent report.
- **Languages:** EN / Simplified Chinese / bilingual. Per-sentence **翻译** buttons are the translation mechanism; there are no always-visible paired Chinese paragraphs. Chinese audio was removed site-wide (English TTS only). Easy-read font is the default.
- **Mobile tab bar labels are Chinese-only at ≤900px by design.** Desktop rail follows the selected language. Do not "fix" this without the owner saying so.

## Storage keys — never change their semantics

- `vaProfiles.v1` — profile registry. Each profile mirrors `va*` keys into `vaP_<profileId>__` namespaces (a boot shim monkey-patches `Storage.prototype`).
- `vaDone.v1`, `vaFlashSrs.v1` (SM-2), `vaMistakes.v1` / `vaQE2.v1`, `vaAssessment.v1` (frozen baseline), `vaReview.v1`, FSRS keys.
- Mastery rule: `c1-rw5-cap-e3-latest80-v1`. TEIs are excluded from mastery.
- New stored fields must be **additive** and safely absent from older records. Never migrate, rename, or reinterpret existing keys.

## Illustrations — where they live

- `IMP_ILL` — 152 entries: 140 SVG diagrams + 12 batch-D vocabulary WebPs.
- `IMP_COMP` — 35 diagram companions (batch E), shown beside their SVG, never replacing it.
- `EMPTY_ILL` — 3 empty-state images. `CELEB_ILL` — 2 celebration images. `SOL_ILL` — 2 SOL practice images. Plus 4 subject banners.
- **Flashcard art is answer-side only.** Images/alt text must never appear in the DOM before a card is flipped (main deck), before reveal (Daily Review / mistake review), or in the attempt phase. Check all three players, not just the main deck — a Daily Review gap was caught this way before.
- Art rules: anime style matching the hero, green `#365B43` anchor, **no text/letters/numbers baked into artwork, no real children's photos or likeness, bilingual alt text**.

## Floating pills (back-to-top / back-to-lesson)

Identical behaviour in labs and lessons: small, semi-transparent, auto-hide after ~6s idle, hidden during quizzes. They stay awake through press, drag, release, and keyboard activity — not scroll alone. They step aside **only** for genuine text entry (text inputs, textareas, selects, contenteditable, lesson video player) — never for sliders, checkboxes, or radios. Do not change this.

## Rules for any change

1. **Nothing may break.** Test each changed view on its own. Keep saved learner data intact.
2. **Verify at 390px mobile and 1440px desktop, in EN and Simplified Chinese**, at every step.
3. **Test before publishing.** Click through every shipped item's entry points in a real browser before calling it live. "Live" only after the front door opens.
4. Every new string needs **EN + Simplified Chinese**.
5. Never invent branding, logos, or details. Never reintroduce real children's photos/likeness.

## Do NOT re-raise (decided, parked, or unfixable)

- History sequence is the classic one (G6 = US to 1865, G7 = 1865–Present, G8 = Civics & Economics), despite the 2023 SOL re-sequence. Owner decision.
- No Chinese TTS (by design). Source attributions removed site-wide (owner directive, incl. a Wikimedia photo credit — he was warned it is a license condition and chose to keep it removed).
- Predict→Test→Prove lab loop: built but **gated off**. Do not re-propose.
- Share-URL deep links are **unfixable** — the share wrapper drops the hash. Do not attempt workarounds.
- Re-tapping the mobile More tab and staying on More is **expected behaviour**, not a bug.
- Hero refresh and lab headers were scoped out of the graphics run. Do not re-propose.
- Illustrations for the 269 research-vocabulary cards were never in scope.
- SOL scale is 0–600. There is no 100-point scale; cut scores phase in 2026-27 → 2029-30.

## Decision records

The authority-stamped decision records live in the project workspace at
`files/va/decisions.md` (goal: virginia-grades-6-8-learning-site) — one entry
per settled decision (id, decision, authority, date, decided by, rationale).
The "Do NOT re-raise" list above is a summary; `decisions.md` is the source
of truth. The `va` CLI (`tools/va`) and the bug-fix template
(`files/va/bug-fix-template.md`) both reference it.

## Publishing (how changes go live)

- **Owner approval is required before publishing.** Work on a `codex/` branch, present the tested revision, and wait for approval before merging/pushing a publishing branch or deploying the account backend. Verify the repository’s current Pages source/workflow; do not assume a push is harmless.
- The contents API previously rejected the large HTML with HTTP 413. Use the checked-out repository and normal Git transport for a reviewed change; do not overwrite newer work. Confirm the published front door and deployment status after approval.
- GitHub is the main source. No Muse re-export is required. Free tier only: no paid upgrades or automatic resource provisioning. See `account-service/README.md` for plan verification and staged deployment steps.

## Current status (2026-11-09 release)

- Cleanup + graphics run complete and live: 4 subject banners, 12 vocabulary illustrations, 35 diagram companions (+ Daily Review fix), 3 empty-state images, 2 celebrations, 2 SOL images.
- **Account backend deployed and verified on Workers Free + D1 Free.** Owner selected parent-managed usernames and strong generated codes, free tier only, and GitHub as source. Current service supports one owner-managed household (up to 12 learners), recovery, revocation, isolated progress, and explicit concurrent-save conflicts. Owner publication approval and Free-plan verification were completed November 9. The production endpoint is https://virginia-learning-accounts.erpanelyar.workers.dev. First parent registration is reserved for the owner; private setup material is outside Git. No payment method or subscription is part of this work.
- **Improvement backlog (Astra, ranked 2026-11-07):** 14 ideas. Build-first pick: (1) Find the Missing Step — prerequisite repair route, (2) Debug This Answer — misconception lab, (3) Protect My Progress — backup/restore. Six backlog items were dropped as not worth building (lab missions, quests, portfolio, study partners, downloadable packs, tutor prompts). Ask the owner which batch to build; never assume the top-N is the job.
- Test results from external testers arrive as a QA zip or Drive link; the inbox for them is `machimachi@agentmail.to` (do not use it unprompted for anything else).
