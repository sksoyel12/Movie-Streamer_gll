# S-Movie

A Netflix-style movie/TV/anime streaming app (S-Movie Original) with an Expo mobile client, a companion download-page website, and an Express API server that powers TMDB-backed content, auth, chat, and streaming-link resolution.

## Run & Operate

This project has 4 artifacts, each with its own workflow (already running in dev):

- **S-MOVIE — Streaming App** (`artifacts/s-movie`, Expo/React Native, preview `/`) — `pnpm --filter @workspace/s-movie run dev`
- **API Server** (`artifacts/api-server`, Express 5, preview `/api`) — `pnpm --filter @workspace/api-server run dev`
- **S-Movie — Download Page** (`artifacts/smovie-download`, React+Vite, preview `/smovie-download/`) — `pnpm --filter @workspace/smovie-download run dev`
- **Canvas / Component Preview Server** (`artifacts/mockup-sandbox`, design sandbox, preview `/__mockup`)

Other useful commands:
- Fresh import bootstrap: `pnpm install --frozen-lockfile`
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

- `artifacts/s-movie/app/(tabs)/index.tsx` — Home screen (hero carousel + 59 genre rows)
- `artifacts/s-movie/lib/categoryMap.ts` — **59-row permanent category list** (single source of truth for row order)
- `artifacts/s-movie/lib/tmdb.ts` — single source of truth for all TMDB calls
- `artifacts/s-movie/lib/genreData.ts` — Netflix-style genre/category catalog used by genre browsing
- `artifacts/api-server/src/routes/` — API routes (auth, chat, stream, scrape, tmdb, identity, etc.)

## Architecture decisions

- **59-row home screen**: All category rows are permanently set in `lib/categoryMap.ts` in the exact user-specified order. Hero banner is at the top; rows follow line by line below it. New entries: `becauseYouLiked`, `becauseYouWatched`, `dreamsToYou`, `onlyOnNetflix`, `actionAdventureMovies`, `top5NetflixKorean` fetchers were added to `lib/tmdb.ts`.
- **Hero banner position**: The carousel (`HeroBannerCarousel`) renders first inside the `ScrollView`, followed immediately by all 59 `MovieRow`/`Top10Row`/special rows — this is permanently set in `app/(tabs)/index.tsx`.
- **Continue watching row**: Uses the dedicated `ContinueWatchingRow` component (position 6), wired via `kind: "special"` with key `"continueWatching"`.
- **User ID & verification system**: on Google Sign-In, the mobile app calls `POST /identity/google-sync`.
- **Security**: 6-layer API security stack in `artifacts/api-server/src/middleware/`.

## Product

Netflix-style browsing (hero carousel, 59 curated genre/mood rows sourced live from TMDB), search, "My List", continue watching, a download page for the Android APK, and an in-app AI chatbot. Streaming links are resolved server-side via the API server.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The mobile app's in-app update checker calls a hardcoded production URL — harmless in dev, noisy in logs.
- `artifacts/s-movie/package.json`'s `dev` script sets `EXPO_PUBLIC_TMDB_API_KEY=$TMDB_API_KEY` — uses fallback to `$EXPO_PUBLIC_TMDB_API_KEY` if blank.
- The Expo web preview renders a blank black screen for this app — it's built for native (Android APK). Don't judge by in-browser screenshot.
- After a fresh import, the Expo workflow starts cleanly after the frozen install; the imported mobile package currently has unrelated pre-existing TypeScript errors in other screens.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
