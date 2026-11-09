# Virginia Grades 6–8 Learning Site

Bilingual English / Simplified Chinese learning for grades 6–8. This revision retains the existing 73 lessons and 19 views, with 559 multiple-choice questions, 25 technology-enhanced items, 545 flashcards, and 22 Play Labs.

[Live site](https://erpan219.github.io/virginia-grades-6-8-learning-site/) · [Handoff](HANDOFF.md) · [Audit](audit/REPORT.md)

**GitHub is the authoritative source**, per the owner's November 9, 2026 instruction. Muse is the historical origin. The owner approved the existing release and subsequent [QA fixes](audit/QA-FIXES-2026-11-09.md) for publication, and confirmed Workers Free is active with no payment method on file. No paid services or upgrades were enabled.

## Edit and verify

The static GitHub Pages frontend comprises `index.html`, `assets/`, and the three external engines in `enhancements/` (`exams-profiles.js`, `research-features.js`, `writing-source.js`). Publish them together. Most existing engine/data code remains in the HTML; maintained additions live in `enhancements/` and `content/`.

The assembler versions each external engine URL with its content hash so a fresh page cannot reuse an older cached engine. Rebuild and verify with:

```sh
npm ci
npm run build
npm run check
npm run test:unit
python3 scripts/preview.py
```

Open `http://127.0.0.1:4173/` for the local-only site. Test 1440px desktop and 390px mobile in English and Simplified Chinese. Keep IDs, storage semantics, bilingual copy, and accessibility behavior intact. Read `HANDOFF.md` before changing the existing engine.

See [browser regression checks](tests/browser/README.md) for the optional Playwright suite and validation-only CI workflow. That workflow does not deploy or enforce the manual publication approval gate. Answer choices are shuffled for new attempts while stored answers retain canonical indices; older seedless saved exams preserve their original order.

## Optional accounts

Local profiles continue to work without a server. The separate [account service](account-service/README.md) implements one parent-managed household, learner usernames and generated secure codes, and cross-device saved progress. The tested service is deployed on Cloudflare Workers Free with D1 Free.

The [account guide](account-service/ACCOUNT-GUIDE.md) explains parent setup, learner sign-in, local-progress import, syncing, and recovery. The private owner setup code is delivered separately; the first production parent account is reserved for the owner to create.

Only Cloudflare **Workers Free + D1 Free** are permitted. No paid upgrades, payment method, email service, or automatic provisioning. The public endpoint is maintained in `enhancements/account-config.js` and enabled only on the production GitHub Pages origin. No credentials belong in frontend code.

For local account testing, run `npm ci`, `npm test`, and `npm run dev` inside `account-service/`, then open `http://127.0.0.1:4173/accounts-preview`. This preview path injects only the loopback test API; it must not be used as a production configuration.

## Publication

Work on a branch, review the completed audit and changes with the owner, then obtain approval before deployment or updating the Pages publishing branch. Confirm the actual Pages source/workflow and the selected Cloudflare account's Free plan first. Never replace current GitHub work with an older Muse export.
