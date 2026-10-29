# Echo

Echo turns the posts people save on LinkedIn, X, Instagram, TikTok and YouTube into one personal library. It keeps every post word for word and rewrites the takeaway in the voice of the person the user says they are: a founder, an analyst, a yoga teacher, a coach, or any mix of those.

This repo holds the iOS app (with a native Share Extension), the website, and the API that runs the ingest, classify and rewrite pipeline.

```
                ┌──────────── iOS app (Expo) ─────────────┐
 Share sheet ──▶│ Swift Share Extension ──┐                │
                │   Vision OCR, App Group │  RN app: Library, Save, Voice, Plus
                └─────────────────────────┼────────────────┘   AdMob rewarded · RevenueCat
                                          ▼
                     Next.js on Vercel  (apps/web)
   POST /api/saves ─▶ ingest ─▶ store ─▶ after(): classify ─▶ rewrite ─▶ embed
                       │                     │ (packages/core, LlmProvider)
                       │                     └─ video? media_jobs ─▶ ffmpeg + Whisper + frame OCR
   AdMob SSV ─▶ /api/webhooks/admob ─▶ ad_unlocks ─▶ rewrite
   RevenueCat ─▶ /api/webhooks/revenuecat ─▶ users.plan
   Vercel Cron ─▶ /api/cron/process-media, /api/cron/x-sync
                                          ▼
                    Postgres + pgvector (packages/db, Drizzle) · Vercel Blob
```

## Repo layout

| Path | What it is |
| --- | --- |
| `apps/web` | Next.js 15 (App Router, Tailwind 4): landing page, waitlist, signed-in library, account and legal pages, and every API route. |
| `apps/ios` | Expo SDK 58 app (Expo Router), the Swift Share Extension in `targets/share`, and a local native module in `modules/echo-shared`. |
| `packages/core` | Shared types, Zod schemas, personas and demo content (`src/`), plus the server-only pipeline (`src/server/`): ingest, classifier, voice engine, fact guard and providers. |
| `packages/db` | Drizzle schema, SQL migrations, typed queries, seed script, and a PGlite test helper. |

## Prerequisites

- Node 22.12 or newer, and pnpm 10 (`corepack enable`)
- Postgres 16 or newer with the `pgvector` extension: a local install, Docker (`pgvector/pgvector:pg17`) or a Neon database
- For iOS: a Mac with Xcode 26, CocoaPods, and an Apple Developer account for device builds

## Local setup

```bash
pnpm install
cp .env.example .env                 # root .env is read by the db scripts
cp .env.example apps/web/.env.local  # read by Next.js
# fill in DATABASE_URL and AUTH_SECRET at minimum (openssl rand -base64 32)

pnpm db:migrate     # creates the vector extension and all tables
pnpm db:seed        # demo@getecho.ai: 8 persona voices, 6 saves across domains, 20 rewrites
pnpm --filter @echo/web dev          # http://localhost:3000
```

What works with which keys:

| Feature | Needs |
| --- | --- |
| Landing page, live demo, legal pages | nothing |
| Sign in on the web | `AUTH_APPLE_ID` + `AUTH_APPLE_SECRET`, or `EMAIL_SERVER` + `EMAIL_FROM`. For local email, any SMTP catcher works, such as Mailpit (`EMAIL_SERVER=smtp://localhost:1025`). |
| Classify and rewrite | `LLM_API_KEY` (Anthropic) |
| Related saves, video transcription | `OPENAI_API_KEY` |
| Screenshot and video uploads | `BLOB_READ_WRITE_TOKEN` |
| X bookmarks | `X_CLIENT_ID`, `X_CLIENT_SECRET` |

To sign in to the web library as the seeded demo user, sign in with email using `demo@getecho.ai`.

### Checks

```bash
pnpm check        # typecheck + lint + test in every workspace (turbo)
pnpm test         # tests only
```

Tests never call live APIs. The database tests run against PGlite (in-process Postgres with pgvector), so they need no server. LLM calls use `FixtureProvider` with recorded outputs in `packages/core/test/fixtures/llm`, and HTTP calls go through a fake `fetch` serving pages and API responses from `test/fixtures/http`. One web test drives the real `ffmpeg-static` binary on a generated clip. After changing prompts, re-record the model fixtures from the live API with `LLM_API_KEY=… pnpm --filter @echo/core record-fixtures`.

## The pipeline

All of it lives in `packages/core/src/server`, wired to the database in `apps/web/lib/services`.

1. **Ingest** (`ingest/`). `POST /api/saves` accepts a URL, text, on-device OCR text, or uploaded media.
   - **X**: with a connected account, the official X API v2 reads the post and unrolls the author's self-thread by `conversation_id`. Without one, it falls back to X's public oEmbed endpoint.
   - **Other links**: OpenGraph plus Readability text, with official oEmbed for TikTok and YouTube. Instagram captions are parsed from `og:description`. Requests are SSRF-checked on every redirect and never use a logged-in session.
   - **Screenshots**: Apple Vision OCR on device; a server vision model is the fallback.
   - **Video**: queued in `media_jobs`. The job extracts mono 16 kHz audio with ffmpeg, transcribes it with Whisper, and OCRs a few keyframes for on-screen captions.
   - **Dedupe**: on `canonical_url` (tracking params like `utm_*`, `igshid`, `si` and `s`/`t` stripped; hosts and paths normalized), on a SHA-256 `content_hash` of normalized text, and on the X post id.
2. **Classify** (`classify.ts`). One structured-output call returns the domain plus domain-specific fields, validated with Zod: tickers, bull and bear case, catalysts and invalidation triggers for markets; sets, reps, rest, tempo and macros for fitness; mechanism, scripts and before/after for sales. If the call fails, a keyword classifier files the save anyway.
3. **Rewrite** (`rewrite.ts`, `prompts.ts`). Produces `{ headline, paraphrase, action_steps[3–5] }` in the voice profile's perspective, tone and writing sample. The **fact guard** (`fact-guard.ts`) rejects any rewrite that mentions a number or `$TICKER` not present in the source, retries once with the violations named, and otherwise stores nothing.
4. **Embed and link**: OpenAI `text-embedding-3-small` (1536 dimensions) into `saves.embedding`, with an HNSW cosine index; `/api/saves/:id/related` returns the nearest saves.

**Swapping the model.** Everything goes through the `LlmProvider` interface (`providers/types.ts`). The Anthropic implementation uses structured outputs, per-task effort, and the server-side refusal fallback (`fallbacks: "default"`), which retries a declined request on a fallback model in the same call. Model names come from `LLM_MODEL_CLASSIFY`, `LLM_MODEL_REWRITE` and `LLM_MODEL_VISION`, all defaulting to `claude-opus-5-5`. To add another vendor, implement `generateObject` and register it in `createLlmProvider` under a new `LLM_PROVIDER` value.

**Background work.** `POST /api/saves` returns as soon as the save is stored; classification and the rewrite run in `after()`. Videos run in the media job, triggered right away through `after()` and retried by Vercel Cron every 5 minutes, at most 3 attempts. The queue is a Postgres table using `FOR UPDATE SKIP LOCKED`, so it needs no extra service.

**Monetization rules** (`lib/services/saves.ts`)
- **Free**: `FREE_SAVES_PER_MONTH` saves per month (default 15) and one voice. Each new save returns an `unlock`; the app shows a rewarded ad with SSV `customData = ad_unlock_id`. AdMob calls `/api/webhooks/admob`, which verifies Google's ECDSA signature, records the reward in `ad_unlocks` once per `transaction_id`, and only then writes the rewrite.
- **Plus**: no ads, unlimited saves, multiple voices, and hourly X sync. RevenueCat webhooks set `users.plan` and `plan_expires_at`.

## iOS app

### Run in the simulator

```bash
cd apps/ios
export EXPO_PUBLIC_API_URL=http://localhost:3000     # the simulator reaches your Mac's localhost
export APPLE_TEAM_ID=YOURTEAMID                       # needed for the App Group and keychain sharing
pnpm prebuild                                          # generates ios/ with the Share Extension target
npx expo run:ios                                       # builds the dev client and opens the simulator
```

After the first build, `pnpm start` is enough for JavaScript changes. Re-run `pnpm prebuild` whenever you change `app.config.ts`, `targets/share/*`, or native dependencies.

Notes for the simulator:
- **Sign in with Apple** needs an Apple ID signed in under the simulator's Settings. Otherwise use the email link: open the email in the simulator's Safari and tap Open Echo.
- **Share Extension**: share a page from Safari, or a photo from Photos, and pick Echo. To debug it, choose the `EchoShare` scheme in Xcode and run it against Safari.
- **Ads**: debug builds always use Google's test rewarded unit. SSV callbacks only reach a public URL, so test the full unlock flow against a deployed preview, or expose your machine with a tunnel and set that URL on the test ad unit.
- **Purchases**: add a StoreKit configuration file in Xcode, or use a Sandbox tester, and set `EXPO_PUBLIC_REVENUECAT_API_KEY`.

### How the app and the Share Extension talk

- **Auth**: the bearer token from `/api/auth/mobile/*` lives in the keychain access group `$(AppIdentifierPrefix)group.ai.getecho.shared`. The app writes it through `modules/echo-shared`, and the extension reads it in `SharedStore.swift`.
- **Context**: the API URL, the active voice name and the plan go to the App Group `UserDefaults` (`group.ai.getecho.shared`), so the sheet can say "Rewrite as {voice}".
- **Hand-offs**: the extension posts links, text and screenshots itself (downscaled images go to `/api/uploads/direct`). Videos are too large for an extension request, so they're copied into the App Group and queued. For free users it queues an `unlock`, so the rewarded ad plays the next time Echo opens (`lib/pending-runner.ts`).

### EAS Build and TestFlight

1. `npm i -g eas-cli && eas login`, then run `eas init` in `apps/ios`. Put the project id in `EAS_PROJECT_ID`, or let EAS write it.
2. In App Store Connect, create the app with bundle id `ai.getecho.app`. Under Identifiers, enable **App Groups** (`group.ai.getecho.shared`), **Sign in with Apple** and **Keychain Sharing** for `ai.getecho.app` and `ai.getecho.app.share`. EAS can create these for you on the first build if you let it manage credentials.
3. Set the build-time variables (EAS dashboard or `eas env:create`): `APPLE_TEAM_ID`, `ADMOB_APP_ID`, `EXPO_PUBLIC_REVENUECAT_API_KEY`, `EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID`. `EXPO_PUBLIC_API_URL` is set per profile in `eas.json`; change `https://getecho.ai` to your domain.
4. `eas build -p ios --profile production`
5. `eas submit -p ios --profile production`. Set `ascAppId` in `eas.json` first. The build then shows up in TestFlight once it finishes processing.
6. Before App Review, check that:
   - the privacy policy URL (`/privacy`) and the account deletion steps (`/data#delete`) are entered in App Store Connect;
   - the App Privacy answers cover the email address, user content, identifiers (user id for purchases and ads) and usage data. Ads are non-personalized and there is no tracking, so no App Tracking Transparency prompt is needed;
   - subscription products `echo_plus_monthly` ($7.99) and `echo_plus_annual` ($59.99) exist in one subscription group, each with a review screenshot;
   - the review notes include a demo account (an email that can receive the sign-in link) and explain the Share Extension.

## Third-party setup

**AdMob**
- Create the iOS app and a rewarded ad unit. Put their ids in `ADMOB_APP_ID`, `ADMOB_REWARDED_UNIT_ID` and `EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID`.
- On the ad unit, turn on server-side verification with the callback URL `https://YOUR_DOMAIN/api/webhooks/admob`.

**RevenueCat**
- Add the App Store app and the two products, an entitlement with identifier `plus`, and a `default` offering with Monthly and Annual packages.
- The Apple public SDK key goes in `REVENUECAT_API_KEY` and `EXPO_PUBLIC_REVENUECAT_API_KEY`.
- Add a webhook to `https://YOUR_DOMAIN/api/webhooks/revenuecat` with the Authorization header value set to `REVENUECAT_WEBHOOK_SECRET`.

**X API**
- Create a project and app with OAuth 2.0 enabled as a confidential client, callback URL `https://YOUR_DOMAIN/api/x/callback`, and scopes `tweet.read users.read bookmark.read offline.access`.
- The bookmarks endpoint needs a paid X API access tier.
- Thread unrolling uses recent search, which covers the last 7 days; older threads import the posts that can be looked up directly.

**Sign in with Apple (web)**
- Create a Services ID with return URL `https://YOUR_DOMAIN/api/auth/callback/apple`.
- Generate the client secret JWT for `AUTH_APPLE_SECRET`. Apple caps it at 6 months, so set a reminder to rotate it.

## Vercel deploy checklist

1. Import the repo into Vercel and set **Root Directory** to `apps/web`. Leave "Include files outside the root directory" enabled; pnpm workspaces and the `@echo/*` packages need it. The framework preset is Next.js, and the default install and build commands work.
2. Add Postgres: a **Neon** project (Vercel Marketplace or neon.tech) with the pooled connection string as `DATABASE_URL`. pgvector ships with Neon; the first migration runs `CREATE EXTENSION IF NOT EXISTS vector`.
3. Run migrations against production from your machine or CI: `DATABASE_URL=… pnpm db:migrate`. Don't seed production.
4. Create a **Vercel Blob** store and connect it, which sets `BLOB_READ_WRITE_TOKEN`.
5. Set environment variables from `.env.example`: `AUTH_SECRET`, `AUTH_URL` (your production URL), `LLM_API_KEY`, `OPENAI_API_KEY`, `X_CLIENT_ID`, `X_CLIENT_SECRET`, `ADMOB_APP_ID`, `ADMOB_REWARDED_UNIT_ID`, `REVENUECAT_API_KEY`, `REVENUECAT_WEBHOOK_SECRET`, `AUTH_APPLE_ID`, `AUTH_APPLE_SECRET`, `APPLE_BUNDLE_ID`, `EMAIL_SERVER`, `EMAIL_FROM` and `CRON_SECRET`. Optional: `NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_APP_STORE_ID` and `NEXT_PUBLIC_PRIVACY_EMAIL`.
6. **Cron**: `vercel.json` schedules `/api/cron/process-media` every 5 minutes and `/api/cron/x-sync` hourly. Hobby plans only allow daily crons, so use Pro or change the schedules. Vercel sends `CRON_SECRET` automatically.
7. **Function duration**: routes that run the pipeline set `maxDuration` to 120–300 seconds. That needs Fluid Compute (the default for new projects) or a Pro plan.
8. **ffmpeg**: `next.config.ts` traces the `ffmpeg-static` binary into the media routes. Allow its install script (already listed under `onlyBuiltDependencies` in `pnpm-workspace.yaml`).
9. Point external services at the deployment: the AdMob SSV URL, the RevenueCat webhook, the X callback and the Apple return URL.
10. Smoke test:
    - `curl https://YOUR_DOMAIN/api/me` returns 401;
    - joining the waitlist works;
    - you can sign in and see an empty library;
    - pasting a link creates a save that becomes ready within about 20 seconds.

## Before launch

- Have a lawyer review `/privacy` and `/terms`, and set `NEXT_PUBLIC_PRIVACY_EMAIL` to a monitored inbox.
- Replace `getecho.ai` in `eas.json` and `ascAppId` with your real values.
- The Share Extension and native module Swift code are written against iOS 17 APIs but weren't compiled in the environment that produced this repo (no Xcode). Build once in Xcode and fix anything the compiler flags before the first TestFlight build.
- Instagram often serves a login wall to servers. When a link can't be read, Echo asks for a screenshot or the pasted text instead of scraping. `packages/core/src/server/ingest/instagram.ts` holds the interface for a future Instagram Messaging integration.
