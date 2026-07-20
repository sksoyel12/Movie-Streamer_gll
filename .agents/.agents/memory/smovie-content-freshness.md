---
name: S-Movie content freshness system (hero rotation, row shuffle, multi-asset)
description: How daily hero rotation, category shuffle, and per-card alt-art rotation are implemented in artifacts/s-movie, and a Movie-type gotcha to remember when touching popularity-based sorting.
---

## Daily-rotation helpers (Hero Banner)
`dailySeed()` / `dailyRotationIndex(poolSize, salt)` / `rotateArray(items, offset)` in `lib/tmdb.ts`
give a rotation that is **stable all calendar day, shifts once every 24h** — no timers or
persisted state needed, since it's purely derived from `new Date()`. Use `salt` to get
independent-but-stable rotations from the same day-seed (e.g. one salt per content pool).

**Why:** the ask was "rotate every 24 hours", not "reshuffle on every open" — a naive
`Math.random()` on each fetch would reshuffle every 5-minute background refresh too.

**How to apply:** any future "changes daily" requirement (not "changes every render") should
reuse these helpers rather than inventing a new time-bucketing scheme.

## Popularity-weighted shuffle (category rows)
`weightedShuffleByPopularity` in `lib/badgeUtils.ts` implements weighted random sampling
(`key = random() ** (1/weight)`, sort desc) — different order every call, but higher-popularity
items still statistically surface first. Distinct from `sortByPopularityDesc`, which is a strict
deterministic sort (kept for TOP 10 badge ranking, which must stay accurate to real popularity
even though the *display* order of a row is shuffled).

**Why:** "shuffled based on popularity" needs both freshness (changes every load) and bias
(not pure noise) — a strict sort or a plain `Math.random()` shuffle each satisfy only one half.

## Movie type didn't declare `popularity`
`data/movies.ts`'s `Movie` type had no `popularity` field even though `MovieRow.tsx`'s
`mapResults` was already assigning `m.popularity` via an `as CardItem` cast. This was invisible
until a generic helper constrained to `{ popularity?: number }` was called with `CardItem[]` —
TS then errors "no properties in common" because the *declared* type has zero overlapping
property names with the constraint (cast bypasses this until then).

**Why:** `as CardItem` casts silently hide missing fields from the type checker; the gap only
surfaces when something else tries to use that field generically.

**How to apply:** if you see "no properties in common" on a generic call involving `CardItem`/
`Movie`, check whether the field being passed is actually declared on the `Movie` type in
`data/movies.ts` (it was added there for `popularity`) — don't just widen the generic constraint.

## Real Play Store deep linking (Games tab "Get Game")
Use `Linking.canOpenURL("market://details?id=<pkg>")` (Android only) then
`Linking.openURL(...)`, falling back to the plain `https://play.google.com/store/apps/details?id=<pkg>`
URL if `market://` can't be resolved (iOS, web preview, no Play Store app). This
replaced an earlier in-app WebView that faked the Play Store page with a spoofed
mobile Chrome user-agent — that was never a real deep link, just a rendered
clone, so it always looked slightly off and never triggered the actual "Install"
flow through Play.

**Why:** the ask was for a genuine deep link to the Play Store app/page, not an
in-app browser skin of it.

**How to apply:** any future "open the app store page for X" feature should
reuse this `market://` + `https://` fallback pattern rather than reaching for a
WebView.

## Multi-asset (alt-poster) rotation on category cards
Per-card artwork rotation lives in a `RowCard` component (`components/MovieRow.tsx`) — hooks
require an actual component, not the inline `renderItem` closure that existed before. It calls
the existing `fetchRandomPosterUri(tmdbId, mediaType, fallback)` (already used for the hero) on
mount, keyed off `refreshKey` so pull-to-refresh re-rolls the pick. Relies on the existing
in-memory pool cache + global request queue in `lib/tmdb.ts` to stay bounded across ~50 rows.

**Why:** hooks can't run inside a plain function passed as `renderItem`; a dead `GlowCard`
component already existed in the file for this exact reason but was never wired in.
