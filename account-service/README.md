# Account and progress service — Cloudflare Free

This separate Cloudflare Worker adds one parent-managed household to the existing GitHub Pages site. It does not replace the local learner-profile format or create new lesson sections. GitHub is the source of truth, per the owner's November 9 instruction. **The owner approved publication on November 9, 2026 and supplied a dashboard screenshot confirming Workers Free active and no payment method. The isolated Worker and D1 database are now deployed.**

See the [account guide](ACCOUNT-GUIDE.md) for parent and learner instructions. Leave production parent registration unclaimed for the owner and deliver the private setup code separately.

## Features

- One parent registers with an owner-issued setup code. The server generates a sign-in code and a separate one-use recovery code.
- The parent creates up to 12 learners, renames/disables them, resets their codes, and can read or update their progress. Learners cannot manage accounts or access each other's data.
- A new sign-in code revokes old sessions. Recovery rotates both parent codes and revokes existing parent sessions. Disabling a learner revokes their sessions without deleting their saved learning history.
- Progress snapshots carry a revision. A stale save returns `409 revision_conflict`; the client must ask which copy to keep. It never silently overwrites another device's newer snapshot.
- Existing browser progress continues to work when the service is absent, the network is down, or a free-tier quota is reached.

## Run and verify

Use Node `22.23+`, `24.22+`, or `26.12+` (the pinned `cf` CLI's supported versions).

```sh
npm ci
npm test
npm run build
npm run dev
```

`npm run dev` starts **only** a local Miniflare/workerd API at `http://127.0.0.1:8787`. Its D1 test database lives in ignored `.local/d1/`. The setup code printed by that process is a fixed local fixture, never a production credential. Set `LOCAL_SITE_ORIGIN` to a comma-separated list of explicit local site origins if the preview uses a different port. Local defaults allow only loopback origins on ports 8000, 4173, and 8765.

The tests use isolated, temporary D1 databases. Ten integration tests cover setup, credential storage, session expiry, logout, role/household isolation, code reset, disable, recovery replay, concurrent saves, malformed/hostile snapshots, CORS, rate limiting, learner limits, the observed live-site QA profile, and persistence across an actual preview-process restart. The observed fixture contains 20 real-format learning fields from a dedicated test learner, including an exam, writing, source investigation, guided practice, review, and settings. It round-trips byte-for-byte. Only device backup-reminder metadata is intentionally excluded. The restart test launches `dev.mjs`, creates accounts and progress through HTTP, stops that process, launches it again against the same directory, and verifies that the original credentials, sessions and progress still work.

The local preview uses Miniflare 5's `resourcePersistencePath`; its legacy `d1Persist` option is not supported. That mismatch was found during the offline QA restart and corrected before publication. Only disposable QA accounts in the earlier temporary emulator were affected; no production service existed. Set `VA_LOCAL_STATE_DIR` only when a separate local test state directory is intended.

The runtime is pinned to November 9, 2026. Miniflare 5 beta is pinned because the registry's stable Miniflare 4 runtime supports only dates through August 6; the current Cloudflare `cf` build tool also uses the beta generation. This is development tooling only; the Worker uses standard platform APIs and has no runtime npm dependencies. The Cloudflare build succeeds locally.

## API contract

All bodies are JSON. Authenticated requests use `Authorization: Bearer <token>`. Keep the token in tab-scoped `sessionStorage`, never in a `va*` learner key or a backup. Sessions last 12 hours. CORS permits only configured exact origins; there are no cross-site cookies.

| Request | Body / result |
| --- | --- |
| `POST /v1/parent/register` | `{username,setupCode}` → `{user,token,expiresAt,signInCode,recoveryCode}`; can succeed once per database |
| `POST /v1/auth/login` | `{username,code}` → `{user,token,expiresAt}` |
| `POST /v1/auth/recover` | `{username,recoveryCode}` → new session and both replacement codes |
| `GET /v1/me` | `{user,progressKeys,maxProgressBytes}`; use this allowlist as the sync capability contract |
| `POST /v1/auth/logout` | Revokes current session |
| `POST /v1/auth/logout-all` | Revokes all current user's sessions |
| `GET /v1/learners` | Parent only; `{learners:[...]}` |
| `POST /v1/learners` | Parent only; `{username,displayName}` → `{learner,signInCode}` |
| `PATCH /v1/learners/:id` | Parent only; `{displayName?,disabled?}`; revokes that learner's sessions |
| `POST /v1/learners/:id/reset-code` | Parent only; returns replacement `signInCode` and revokes old sessions |
| `GET /v1/progress` | Learner only; `{revision,data,updatedAt}` |
| `PUT /v1/progress` | Learner only; `{revision,data}` → new `{revision,updatedAt}` |
| `GET/PUT /v1/learners/:id/progress` | Same progress contract for that learner's parent |

`user`/`learner` contains `{id,username,displayName,role,disabled}`. `data` maps allowlisted logical storage keys to their **raw localStorage string values**, preserving existing semantics. Unknown keys are rejected. Account state, registry entries, profile-operation journals, locks, and device backup reminders are not synced.

Writing Studio and Source Detective keys include a device-local profile ID. The wire aliases `va-ll:f08:v1` and `va-ll:f09:v1` must be mapped to/from `va-ll:<kind>:v1:profile:<encodeURIComponent(activeLocalProfileId)>`. Do not copy one device's profile suffix to another device. The actual exam key `vaSolExam.v1` is included alongside the distinct SOL Challenge key `vaSOL.v1`; stored exam deadlines are preserved, not restarted.

Errors have `{error:{code,message,...}}`. `409 revision_conflict` includes `currentRevision`; `429 rate_limited` includes `retryAfter` seconds and a `Retry-After` header. Error text from the API is an English diagnostic; the bilingual frontend must translate by error code. All response values remain untrusted: use `textContent` or proper escaping, not HTML interpolation.

## Cost and security boundaries

- **Free tier only.** No upgrade, payment method, paid product, email service, or subscription is needed by this implementation. Use Workers Free and D1 Free; do not run it in a paid account and assume the usage is capped for free.
- Cloudflare currently includes 100,000 Worker requests/day and 10 ms CPU per invocation on Free; D1 Free includes 5 million row reads/day, 100,000 row writes/day, 5 GB total storage and 10 databases. Free quota exhaustion stops requests rather than upgrading the account. References: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [free-limit enforcement](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/).
- One household, a hard limit of 12 learners and a 1 MiB serialized snapshot per learner keep intended usage small. Large existing histories are rejected explicitly; local data remains intact and can still be exported. No data is silently omitted to make a save fit.
- Codes use 160 cryptographically random bits; session tokens use 256. Only domain-separated SHA-256 hashes are stored. These are random credentials, not human-chosen passwords; low-entropy PINs/passwords are not accepted. Secret comparisons use the Workers Web Crypto timing-safe comparison.
- Persistent D1 limits enforce 30 auth attempts/IP/15 minutes, 10 attempts/username/15 minutes, 30 parent-management operations/hour, and 120 progress writes/learner/minute. IPs are stored only as salted hashes. A six-hour cleanup deletes expired rate buckets and sessions. The frontend should debounce saves and avoid polling.
- Payloads have byte, depth, node-count, field, string, and basic schema limits. This is not complete validation of every legacy record's nested schema. Prototype-pollution fields and HTML tag-like openers (including incomplete tags) are rejected. Plain math such as `x < y` or `2 < 3` is supported; ambiguous unspaced text such as `x<y` is kept locally and requires spacing before it can sync. This supplements frontend escaping; it is not permission to trust arbitrary imported values.
- No emails, birthdays, legal names, or addresses are requested. Use nicknames. Learning answers remain private within the household. Neither request bodies nor credentials are logged. Secrets must stay in Worker secret bindings.
- The static GitHub Pages origin is shared by the owner's other Pages repositories. Every script served from that origin is part of the trust boundary. Do not add untrusted third-party scripts; a dedicated domain would reduce that boundary but is not required for this free implementation.

## Approval and deployment handoff

The owner selected **Erpanelyar@gmail.com's Account** and supplied the Free-plan evidence on November 9. The connector cannot read billing subscriptions; verification came from the owner and dashboard screenshot, not from `default_usage_model: standard`.

Production API: `https://virginia-learning-accounts.erpanelyar.workers.dev`. D1 UUID: `2f34707d-9c4a-4593-9b45-788031cfba70`. The deployment used the authenticated Cloudflare connector to upload the exact tested bundle with secret bindings, followed by enabling workers.dev and the six-hour cleanup schedule. The CLI was not authenticated. Six public endpoint checks passed; parent registration remains unclaimed. See [deployment evidence](../audit/evidence/deployed-api-checks.json).

For a future fresh deployment or recovery, use the following CLI procedure after the required approval and Free-plan verification:

1. Use an authenticated `cf` session for **Erpanelyar@gmail.com's Account**, after confirming its Free plan. Set `CLOUDFLARE_ACCOUNT_ID` to that account. `cf auth login` is interactive; do not ask the owner to paste a token into chat.
2. Create a new, isolated D1 database with `cf d1 create --name virginia-learning-accounts`. Capture the returned database UUID in `D1_DATABASE_ID`; never reuse an unrelated database.
3. Apply the provided schema with `cf d1 migrations apply "$D1_DATABASE_ID" --dir migrations`. The CLI requires the database UUID, not its name.
4. Prepare a private, mode-0600 JSON file containing fresh `SETUP_CODE` and `RATE_LIMIT_SALT` strings, outside Git. Both must be at least 32 characters and generated with a cryptographic RNG. Set `VA_SECRETS_FILE` to that file's path. Do not reuse the local fixture values or place secret values in the HTML, configuration, Git history, shell arguments, screenshots or QA reports. JSON avoids dotenv variable expansion.
5. Build with `npm run build`. Review the generated Worker binding, trusted origin, cleanup schedule and database UUID. Deploy only after approval with `cf deploy --secrets-file "$VA_SECRETS_FILE" --provision=false`. The `--provision=false` flag prevents the CLI from silently creating additional resources. The file path is passed as an argument, not the secret values. The site remains offline-first if the API is not configured.
6. Set the site's `VA_ACCOUNT_CONFIG.apiBase` to the actual approved HTTPS Worker URL. Verify parent setup, learner sign-in, save on one browser, restore on another, code reset, conflict handling, offline fallback and EN/ZH mobile/desktop layouts. Publish the reviewed GitHub Pages changes only after the final approval.

If the owner does not want to publish the account backend yet, keep `apiBase` unset; no network account features or misleading cloud-save claims should be enabled.

Current references: [cf project/build configuration](https://developers.cloudflare.com/cf/projects/), [programmatic bindings](https://developers.cloudflare.com/cf/projects/cloudflare-config/), [D1 local tests](https://developers.cloudflare.com/d1/best-practices/local-development/), [Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/).
