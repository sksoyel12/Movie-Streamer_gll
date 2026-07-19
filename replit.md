# S-Movie

A Netflix-style movie/TV/anime streaming app (S-Movie Original) with an Expo mobile client, a companion download-page website, and an Express API server that powers TMDB-backed content, auth, chat, and streaming-link resolution.

## Run & Operate

This project has 4 artifacts, each with its own workflow (already running in dev):

- **S-MOVIE — Streaming App** (`artifacts/s-movie`, Expo/React Native, preview `/`) — `pnpm --filter @workspace/s-movie run dev`
- **API Server** (`artifacts/api-server`, Express 5, preview `/api`) — `pnpm --filter @workspace/api-server run dev`
- **S-Movie — Download Page** (`artifacts/smovie-download`, React+Vite, preview `/smovie-download/`) — `pnpm --filter @workspace/smovie-download run dev`
- **Canvas / Component Preview Server** (`artifacts/mockup-sandbox`, design sandbox, preview `/__mockup`)

Other useful commands:
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

Env already configured: `DATABASE_URL` (Postgres), plus TMDB/YouTube API keys and source URLs in `.replit` `[userenv.shared]`.

## Stack

- pnpm workspaces, Node.js 20+, TypeScript 5.9
- Mobile: Expo / React Native (expo-router)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle) for the API server, Vite for the download-page web app

## Where things live

- `artifacts/s-movie/app/(tabs)/index.tsx` — Home screen (hero carousel + genre rows)
- `artifacts/s-movie/lib/tmdb.ts` — single source of truth for all TMDB calls
- `artifacts/s-movie/lib/genreData.ts` — Netflix-style genre/category catalog used by genre browsing
- `artifacts/api-server/src/routes/` — API routes (auth, chat, stream, scrape, tmdb, identity, etc.)
- `artifacts/api-server/src/routes/identity.ts` — Google-sync/unique-ID issuance, `/identity/me`, photo-ID verification
- `artifacts/api-server/src/middleware/blockSuspended.ts` — blocks all streaming/API access for suspended accounts
- `artifacts/s-movie/lib/identity.ts` — mobile client for the identity/verification API
- `lib/db/src/schema/` — Drizzle DB schema (`users`, `identityVerifications`, `duplicateAttempts`)

## Architecture decisions

- **User ID & verification system**: on Google Sign-In, the mobile app calls `POST /identity/google-sync`, which creates a permanent Postgres `users` row keyed by Firebase UID with a random non-sequential 8-char `uniqueUserId` (shown in the profile's account modal for support/referral, copyable). Photo-ID checks (blur/tamper/fake-ID detection) run via Gemini (`GEMINI_API_KEY`, same key `routes/chat.ts` already uses) over the base64 image the client submits directly — no raw ID photos are persisted, only the verdict (`identity_verifications` table). A failed check sets `isSuspended=true`, which `blockSuspended` middleware enforces on all streaming/API routes (403 `ACCOUNT_SUSPENDED`) and the mobile app surfaces via a full-screen modal (`lib/suspensionState.ts` + `components/SuspensionBlockModal.tsx`, mirroring the existing VPN-block pattern).
- **Duplicate-attempt detection**: since Google guarantees unique emails per account, cross-account duplicate signup is detected via the existing `X-S-Movie-Device` device fingerprint — a second Google account syncing from a device fingerprint already tied to another user is rejected (409 `DUPLICATE_ATTEMPT`, logged to `duplicate_attempts`) and no second unique ID is issued for that device.
- **Settings architecture**: `app/settings.tsx` is a dedicated full-screen page (reached from "My Profile" → "Settings", below "My Downloads") consolidating Preferences (Notifications, Language, Watch Options), Playback & Download toggles (Family Mode, background downloads, auto-Miniplayer — persisted to AsyncStorage, currently preference-only and not yet wired into filtering/player behavior), Privacy, and More Info & Support (Check update, About us, Privacy Policy, User Agreement, Log out), plus a version/network/storage footer line. It's additive — existing individual rows in "My Profile" (Notifications, Language, Privacy & Terms, etc.) were left untouched. `app/user-agreement.tsx` is a new page for the Terms-of-Use content. Network/storage stats use `expo-network` (`getNetworkStateAsync`) and `expo-file-system/legacy` (`getFreeDiskStorageAsync`/`getTotalDiskCapacityAsync`) — real device values, not mocked.

## Product

Netflix-style browsing (hero carousel, dozens of curated genre/mood rows sourced live from TMDB), search, "My List", a download page for the Android APK, and an in-app AI chatbot. Streaming links are resolved server-side via the API server.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The mobile app's in-app update checker calls a hardcoded production URL (`movie-streamer--sksoyel584845.replit.app/api/version`) instead of the local API server, so it fails with a CORS error in dev — harmless, but noisy in logs.
- `artifacts/s-movie/package.json`'s `dev` script sets `EXPO_PUBLIC_TMDB_API_KEY=$TMDB_API_KEY`, but only `EXPO_PUBLIC_TMDB_API_KEY` is defined in `[userenv.shared]` (no `TMDB_API_KEY`), so it was blanking out the key on every dev start. Fixed with a fallback: `${TMDB_API_KEY:-$EXPO_PUBLIC_TMDB_API_KEY}`.
- The Expo web preview (used by this workspace's screenshot tool) renders a blank black screen for this app even when it's working — the app is built for native (Android APK) and real device testing; don't rely on the in-browser screenshot to judge whether it works.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
