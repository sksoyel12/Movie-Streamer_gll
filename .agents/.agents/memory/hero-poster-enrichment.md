---
name: Hero poster enrichment
description: Root-cause and fix for hero banner showing static unvaried posters despite enrichment code being present
---

## The rule
`toMovieCard` in `app/(tabs)/index.tsx` MUST copy `tmdbId` and `mediaType` from the raw TMDB card into the returned Movie object.

`fetchHero` MUST call `setHeroMovies` exactly ONCE — only after the full enrichment Promise.allSettled completes. Never call it twice (base cards first, then enriched).

`HeroBannerCarousel` must NOT run its own `fetchRandomPosterUri` enrichment on the `movies` prop — the home screen already enriches before passing data in.

## Why
- Without `tmdbId` on the card, `(card as any).tmdbId` is `undefined`. The code falls back to `parseInt(card.id, 10)` where `card.id` is `"tmdb-NNN"`, so `parseInt` returns `NaN`. The `isNaN` guard fires and every card is returned unchanged — enrichment silently skips all 10 hero movies. The carousel always shows the same unvaried TMDB poster.
- Without `mediaType`, `fetchRandomPosterUri` defaults to `"movie"` which is acceptable but should be explicit.
- Two `setHeroMovies` calls trigger the carousel's fade-animation and scroll-reset twice in quick succession — the hero appears frozen at position 0 on every app load.
- A third internal enrichment inside `HeroBannerCarousel` caused a redundant `setEnrichedMovies` state update, creating a triple state-update chain on each fetch.

## How to apply
Any time `toMovieCard` or a similar helper is written/modified, verify `tmdbId` and `mediaType` are explicitly in the returned object. Run a quick grep for `setHeroMovies` calls inside `fetchHero` and confirm there is only one.
