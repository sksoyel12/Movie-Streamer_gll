---
name: Hindi Trailer System
description: Architecture for Hindi-first trailer selection across the S-Movie app
---

## Rule
`lib/hindi-trailer.ts` is the single source of truth for trailer selection. Never write custom priority logic in screen files.

## Priority order (highest to lowest)
1. `iso_639_1 === 'hi' && type === 'Trailer'` from TMDB (score 100)
2. `iso_639_1 === 'hi' && type === 'Teaser'` from TMDB (score 90)
3. `iso_639_1 === 'hi' && type === 'Clip'` from TMDB (score 80)
4. Any Hindi video from TMDB (score 70)
5. YouTube search for "Official Hindi Trailer" via `searchHindiTrailer()` in lib/youtube.ts
6. English Trailer from TMDB (score 50)
7. English Teaser from TMDB (score 40)
8. YouTube search for English trailer via `searchYouTubeTrailer()`

## API
- `pickHindiFromVideos(ytVideos)` — sync, for when you already have TMDB results
- `fetchHindiTrailer(tmdbId, isTV, title, year)` — async, full fetch + 72hr AsyncStorage cache

## Cache
- Key: `smovie_htrl_v1_${tv|movie}_${tmdbId}`
- TTL: 72 hours
- Shape: `{ key: string | null, isHindi: boolean, ts: number }`

## Badge
- Hindi badge style: saffron orange `rgba(255, 103, 0, 0.88)` with white Hindi text `हिन्दी`
- Shown in: hero bottom-left (`heroHindiBadge`), metaRow HI badge (`metaBadgeHindi`), trailer list (`trailerHindiBadge`), New & Hot cards top-right (`hindiBadge`)

## YouTube search
- `searchHindiTrailer(title, year)` in lib/youtube.ts — uses `relevanceLanguage=hi`, tries 4 query variants
- Requires `EXPO_PUBLIC_YOUTUBE_API_KEY` env var; returns null gracefully if missing

**Why:** Indian users expect Hindi trailers first. TMDB has Hindi video entries for Bollywood; YouTube search covers Hindi-dubbed Hollywood.
