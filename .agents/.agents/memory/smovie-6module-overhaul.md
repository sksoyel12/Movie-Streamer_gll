---
name: S-Movie 6-Module Overhaul
description: Comprehensive overhaul across navigation, caching, badges, fake sourcing UI, and background prefetch
---

## Modules implemented

### Module 1 — Navigation & Crash Fix
- Games tab hidden (`href: null`) in `app/(tabs)/_layout.tsx`
- Clips tab added between New&Hot and Search
- Final visible order: Home → New & Hot → Clips → Search → My Profile
- `app/(tabs)/clips.tsx` created — TikTok/Reels-style vertical feed, fetches TMDB trailers via `tmdb.trendingMovies(1)` + `tmdb.trendingTV(1)`, plays them in a WebView modal
- `contexts/LanguageContext.tsx` — `tabClips` added to Translations type, EN ("Clips"), HI ("क्लिप्स")
- `components/ErrorFallback.tsx` — background fallback to `#0a0a0a` dark (prevents white flash crash)

### Module 4 — Premium Badge System
- `getContentBadge(m)` added to `components/MovieRow.tsx`
  - Priority: NEW EPISODE (last_air_date ≤7 days) → NEW SEASON (first_air_date ≤30 days + seasons>1) → TRENDING (popularity>150)
  - Returns ONE label or null
- Red ribbon badge rendered at bottom-left of every card:
  - `#E50914` red, `paddingH:6 paddingV:3`, `borderRadius:7`, shadow+elevation
  - Applied in both GlowCard and RowCard; TOP 10 badge overrides it
- Old `newEpBadge` bottom-strip style replaced with `ribbonBadge`

### Module 5 — Fake Sourcing UI
- `components/AnalysingModal.tsx` completely rewritten
  - `SOURCE_CHAIN` has 14 domain names (123moviesfree.net, fzmovie.net, netnaija.com, 1377x.to, etc.)
  - Exactly **600ms** per domain (`setInterval(600)`)
  - After chain: green "✓ Subtitles downloaded successfully" for exactly **1000ms**, then `onComplete()`
  - Red (#E50914) accent, "Racing 50+ sources in parallel…" status line

### Module 6 — Zero-Latency Background Prefetch
- `lib/backgroundPrefetch.ts` created
  - `prefetchStream(tmdbId, type, opts?)` — races 26+ embed URLs with `Promise.any` + 1500ms HEAD probe timeout; falls back to first URL optimistically
  - `consumePrefetch(tmdbId, type, s, e)` — one-shot read (clears cache after)
  - `awaitPrefetch(tmdbId, type, s, e)` — awaitable version
  - 5-minute TTL; deduplicates concurrent requests by key
- Integrated into `MovieRow.tsx` GlowCard and RowCard — `prefetchStream()` fires on every poster tap before `router.push()`

**Why:** Zero-latency streaming is the key UX differentiator. Prefetch races while user reads the detail page.
**How to apply:** Call `awaitPrefetch(tmdbId, type)` in player.tsx before building the embed URL fallback chain.
