# Virginia Grades 6–8 Learning Site

Bilingual English / Simplified Chinese learning for grades 6–8. The unpublished revision retains the existing 73 lessons and 19 views, with 559 multiple-choice questions, 25 technology-enhanced items, 545 flashcards, and 22 Play Labs.

[Live site](https://erpan219.github.io/virginia-grades-6-8-learning-site/) · [Handoff](HANDOFF.md) · [Audit](audit/REPORT.md)

**GitHub is the authoritative source**, per the owner's November 9, 2026 instruction. Muse is the historical origin. The owner approved this revision on November 9, conditional on verifying free account hosting before publication. That plan verification remains pending; the live site is unchanged.

## Edit and verify

`index.html` remains the standalone GitHub Pages artifact. Existing engine/data changes are in that file. Maintained additions live in `enhancements/` and `content/`; the following commands inline them reproducibly:

```sh
node content/build.mjs
python3 scripts/assemble.py
node content/validate.mjs
node scripts/check-scripts.mjs
python3 scripts/preview.py
```

Open `http://127.0.0.1:4173/` for the local-only site. Test 1440px desktop and 390px mobile in English and Simplified Chinese. Keep IDs, storage semantics, bilingual copy, and accessibility behavior intact. Read `HANDOFF.md` before changing the existing engine.

## Optional accounts

Local profiles continue to work without a server. The separate [account service](account-service/README.md) implements one parent-managed household, learner usernames and generated secure codes, and cross-device saved progress. It is tested locally and **not deployed**.

The [account guide](account-service/ACCOUNT-GUIDE.md) explains parent setup, learner sign-in, local-progress import, syncing, and recovery. The private owner setup code must be delivered separately after deployment; no production parent account has been created.

Only Cloudflare **Workers Free + D1 Free** are permitted. No paid upgrades, payment method, email service, or automatic provisioning. Leave `VA_ACCOUNT_CONFIG.apiBase` unset until the approved backend is ready; the published artifact currently has no production API configured.

For local account testing, run `npm ci`, `npm test`, and `npm run dev` inside `account-service/`, then open `http://127.0.0.1:4173/accounts-preview`. This preview path injects only the loopback test API; it must not be used as a production configuration.

## Publication

Work on a branch, review the completed audit and changes with the owner, then obtain approval before deployment or updating the Pages publishing branch. Confirm the actual Pages source/workflow and the selected Cloudflare account's Free plan first. Never replace current GitHub work with an older Muse export.
