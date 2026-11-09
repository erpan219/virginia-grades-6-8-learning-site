# Handoff — Virginia Grades 6–8 Learning Site

> If you are an AI agent (or a human collaborator) picking this site up: read this whole file before changing anything. It holds the facts that took months to establish. The owner is Erpan.

## What this is

A bilingual (English / Simplified Chinese) learning site for Virginia grades 6–8, aligned to the Virginia Standards of Learning (SOL). Public link, no accounts (accounts are planned, not built — see below).

- **Live site:** https://erpan219.github.io/virginia-grades-6-8-learning-site/
- **Repo:** https://github.com/erpan219/virginia-grades-6-8-learning-site
- **Master copy:** a Muse web artifact (slug `virginia-grades-6-8-learning-site`). This repo is the published, collaboratively editable copy. For major builds, the artifact is master — re-export and replace `index.html` (see "Publishing" below).

## Architecture — read before editing

- **One file.** The whole site is `index.html` (~9 MB, ~21,300 lines). All 203 assets (images, JS) are inlined as base64/data. There is **no build step, no backend, no bundler**.
- **Hash routing, 19 routes**, persistent mounted views, opens on `#/home`. Mobile bottom tab bar: Home · Lessons · Practice · Cards · More. Desktop grouped rail.
- **No backend. Progress lives in the browser (localStorage) only.** There is no server, no database, no sync.
- **Content:** 73 lessons (G6: 21, G7: 21, G8: 31 incl. 9 Algebra I), 13 courses, 511 multiple-choice questions + 25 TEIs, 521 flashcards (497 vocab + 24 cloze), 22 Play Labs, 7 Three.js 3D lessons, FSRS flashcard scheduling, mistake-review queue, Today's Path, SOL practice exams, mastery map, bilingual glossary (228 terms), printable worksheets + parent report.
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

- Edit `index.html` (web editor or clone), commit to `main` — GitHub Pages republishes automatically in about a minute.
- **The API push rejects the 9 MB file (HTTP 413).** To replace `index.html` after a major build, upload it via the GitHub web UI (Add file → Upload files). Small files (this handoff, READMEs) can go through the API.
- The Muse artifact remains master for major builds: export the artifact as one self-contained HTML and upload it as `index.html`.

## Current status (2026-11-07)

- Cleanup + graphics run complete and live: 4 subject banners, 12 vocabulary illustrations, 35 diagram companions (+ Daily Review fix), 3 empty-state images, 2 celebrations, 2 SOL images.
- **User accounts: planned, NOT built.** Plan: parent-created usernames with strong generated sign-in codes (no email), separate parent admin login with recovery codes, no short PINs; separate Cloudflare Worker + database project. Building awaits the owner's decisions (4 learners + parent admin vs 4 total; codes vs PINs; new Cloudflare project; strictly free vs small paid tier).
- **Improvement backlog (Astra, ranked 2026-11-07):** 14 ideas. Build-first pick: (1) Find the Missing Step — prerequisite repair route, (2) Debug This Answer — misconception lab, (3) Protect My Progress — backup/restore. Six backlog items were dropped as not worth building (lab missions, quests, portfolio, study partners, downloadable packs, tutor prompts). Ask the owner which batch to build; never assume the top-N is the job.
- Test results from external testers arrive as a QA zip or Drive link; the inbox for them is `machimachi@agentmail.to` (do not use it unprompted for anything else).
