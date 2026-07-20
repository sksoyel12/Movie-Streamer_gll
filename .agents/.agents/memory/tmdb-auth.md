---
name: TMDB auth in api-server
description: Which TMDB credential to use in the api-server proxy — TMDB_ACCESS_TOKEN env is stale/wrong
---

The Replit secret `TMDB_ACCESS_TOKEN` is set to a token with a different `aud` (api key) than the hardcoded fallback. Specifically the token's `aud` has `c8287` but the working key has `c8207` — they don't match and the env var token returns 401 from TMDB.

**Rule:** The api-server TMDB proxy must use the v3 API key (`api_key=` query param), NOT the Bearer token. The working v3 key is in `TMDB_API_KEY_V3` Replit secret (`352d8760f635c2200e3a64ac8ea64fb0`).

**Why:** `TMDB_ACCESS_TOKEN ?? fallback` resolves to the env var value (non-null), which is the wrong invalid token. Bearer auth fails 401; api_key approach works.

**How to apply:** In `artifacts/api-server/src/routes/tmdb.ts`, only use `TMDB_KEY` (v3 api_key param), never TMDB_TOKEN/Bearer auth.
