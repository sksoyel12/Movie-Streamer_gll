---
name: MovieRow flash bug
description: Posters flash then disappear because inline tmdbFetcher arrow functions change identity on every parent render
---

## Rule
`MovieRow`'s data-fetch `useEffect` must NOT include `tmdbFetcher` or `hdhubFetcher` in its dependency array. Use refs instead.

**Why:** Props like `tmdbFetcher={(p) => tmdb.koreanDramas(p)}` create a NEW function reference on every parent render. If the parent calls `setHeroMovies()` (which it does multiple times during hero-banner enrichment), every `MovieRow` on screen detects a changed `tmdbFetcher` reference and re-runs its fetch, setting `initialLoading=true` and flashing the skeleton, then re-loading all posters.

**How to apply:**
```javascript
const tmdbFetcherRef = useRef(tmdbFetcher);
const hdhubFetcherRef = useRef(hdhubFetcher);
tmdbFetcherRef.current = tmdbFetcher;   // sync on every render, no effect
hdhubFetcherRef.current = hdhubFetcher;

useEffect(() => {
  // use tmdbFetcherRef.current / hdhubFetcherRef.current inside
}, [refreshKey, loadDelay]); // ← intentional: fetchers excluded
```
`refreshKey` is the ONLY intentional re-fetch trigger. The same pattern applies to `loadMore` which reads `tmdbFetcherRef.current` at call time.
