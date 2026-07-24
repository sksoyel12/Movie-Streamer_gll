---
name: TMDB proxy configuration
description: Server-side TMDB requests use the v3 key secret and fail explicitly when it is unavailable.
---

The API server's TMDB proxy must use the `TMDB_API_KEY_V3` Replit secret as a query-string `api_key`, never a bearer token or a client-side credential. The mobile client routes through `/api/tmdb` when the API host is available.

**Why:** TMDB access tokens can be mismatched or invalid for the v3 API, and silently falling back to an unconfigured proxy leaves content feeds stuck in loading states.

**How to apply:** Keep the proxy's missing-secret response explicit (`503`) and provision `TMDB_API_KEY_V3` before diagnosing feed or image loading failures.

The mobile client must prefer the current Replit development domain over an imported `EXPO_PUBLIC_API_URL`, and normalize the `/api` suffix exactly once.

**Why:** Imported projects can retain a stale API URL that returns 404/502 even while the current routed API service is healthy.

**How to apply:** Build the API origin from `EXPO_PUBLIC_DOMAIN` when present, strip any existing `/api`, and append it only at the shared API-base boundary.