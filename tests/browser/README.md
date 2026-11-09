# Browser regression checks

This suite uses fresh, disposable browser contexts and local learner profiles. It never creates a cloud account or submits a production learner record. `npm run test:browser` starts a local static server on port 4175. Set `BASE_URL` to test a separately served preview instead.

```sh
npm ci
npm run build
npm run check
npm run test:unit
npx playwright install chromium
npm run test:browser
```

The route matrix checks 19 views × English/Chinese × 1440px desktop/390px touch-enabled mobile (76 route checks). Additional scenarios cover the 320px layout, canonical answer IDs and lesson first-attempt scores, in-progress lesson reopen, Challenge language switching, flashcard art reveal and rating, SOL exam reload/resume/submit and illustration loading, and Ratio lab keyboard/touch geometry. Local HTTP failures and uncaught page errors fail every test. Legacy seedless exam compatibility is also covered by the pure Node exam-choice tests.

The GitHub Actions `Site QA` workflow is validation-only: it runs on `codex/**` pushes, pull requests to `main`, or manual dispatch, and has read-only repository permissions. It does not publish Pages or change Cloudflare. The existing owner review gate still applies to publication.

Browser tests were authored during the November 9 repair work. Listing/parsing tests is not a browser pass; inspect the actual Playwright report or the separately documented CUA browser checks before claiming executed coverage. Chromium emulation does not certify physical iOS/Android devices, screen readers, Safari or Firefox. Network/CPU throttling and field Core Web Vitals are not part of these regressions.

Configuration follows the official [Playwright CI guide](https://playwright.dev/docs/ci) and [configuration reference](https://playwright.dev/docs/test-configuration). Playwright is pinned in the npm lockfile; browser binaries are installed by the matching CLI.
