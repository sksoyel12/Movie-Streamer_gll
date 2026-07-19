---
name: TMDB consolidation
description: Single source for all TMDB API calls — routing and API key live only in lib/tmdb.ts
---

## Rule
All TMDB API calls go through `lib/tmdb.ts` — either via the `tmdb.*` object methods or the exported `tmdbGet(path, params)` function. No other file should define a `TMDB_KEY` constant or call `api.themoviedb.org` directly.

**Why:** The user's ISP blocks `api.themoviedb.org` DNS; all calls must route through the server proxy at `/api/tmdb/*path` first (configured in `artifacts/api-server/src/routes/tmdb.ts`), with a direct-TMDB fallback inside `lib/tmdb.ts` only.

**How to apply:** When adding TMDB fetching to any new file, import `{ tmdb, tmdbGet }` from `@/lib/tmdb` and use those. The server proxy uses the `TMDB_API_KEY_V3` Replit secret (v3 api_key=). The `TMDB_ACCESS_TOKEN` secret has an invalid/mismatched token — ignore it, always use v3 api_key.

## Files cleaned up
Removed scattered `TMDB_KEY` constants + direct fetch calls from:
- `lib/streamingService.ts`
- `lib/notifications.ts`
- `lib/animeApi.ts`
- `contexts/DownloadContext.tsx`
- `app/movie/[id].tsx`
