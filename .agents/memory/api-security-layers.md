---
name: API Security Layers
description: Four security layers added to the api-server; what each does, where it lives, and how the mobile app integrates.
---

# API Security Layers

## What was built

Four security layers added to `artifacts/api-server`:

1. **Firebase JWT auth** — `src/middleware/firebaseAuth.ts`
   - `requireAuth` middleware verifies Bearer token via Firebase Identity Toolkit REST API
   - Results cached 5 min (up to 10k entries) to avoid per-request network calls
   - Attaches `req.uid` and `req.phone` for downstream use (e.g. encryption key derivation)

2. **CORS whitelist** — `src/app.ts`
   - Allows: `*.replit.dev`, `*.replit.app`, `localhost`, regex-safe `ALLOWED_ORIGINS` env var
   - Native mobile apps (no Origin header) always pass through
   - `app.options(/.*/, cors(corsOptions))` — must use RegExp, not `"*"` (Express 5 + path-to-regexp v8 incompatibility)

3. **Rate limiting** — `src/middleware/rateLimit.ts`
   - `streamLimiter`: 30 req/min, keyed by `uid` (auth) or `ipKeyGenerator(req)` (unauth) — must use `ipKeyGenerator` from `express-rate-limit`, not `req.ip` directly (ERR_ERL_KEY_GEN_IPV6 error otherwise)
   - `generalLimiter`: 120 req/min (applied globally in app.ts)
   - `authLimiter`: 10 req / 15 min on OTP endpoints

4. **Anti-bot** — `src/middleware/antiBot.ts`
   - Blocks: no UA, bot UA patterns (curl, wget, python-requests, puppeteer, etc.)
   - Requires `X-S-Movie-Client: SMovie-Android/1.0` (or iOS/Web variants)

5. **AES-256-GCM URL encryption** — `src/lib/streamCrypto.ts`
   - Key = HMAC-SHA256(SESSION_SECRET, `uid:hourSlot`), rotates hourly
   - `/api/auth/stream-key` (POST, auth-gated) returns hex key + expiresAt for client to decrypt locally
   - `encryptUrl(url, uid)` wire format: `<12-byte-iv-hex>:<ciphertext+gcm-tag-base64>`

## Route protection structure

`src/routes/index.ts` uses a `protectedRouter` sub-router:
```
Public: health (/healthz), image, tmdb, version, build-status, chat, auth
Protected (antiBot → requireAuth → streamLimiter): stream, scrape, get-stream, vegamovies
```

## Mobile app integration

- `artifacts/s-movie/lib/apiClient.ts` — injects Firebase token + `X-S-Movie-Client` header; `ensureStreamKey()` fetches + caches the AES key; `invalidateAuth()` on sign-out
- `artifacts/s-movie/lib/streamCrypto.ts` — WebCrypto API (crypto.subtle, available in RN 0.71+); `setStreamKey(hex, expiresAt)`, `decryptUrl(enc)`, `tryDecrypt(value)` (graceful fallback)
- `artifacts/s-movie/lib/streamingService.ts` — `getDirectStream()` now uses `apiClient.get()` and `tryDecrypt()` on returned URLs

## Known gaps (proposed as follow-up tasks)
- UI login gate before Watch button calls getDirectStream (#2)
- Firebase API key in env var not hardcoded (#3)
- Proactive stream-key refresh before hour boundary (#4)

**Why:** zod must be installed in api-server AND marked external in build.mjs so the runtime can find it (the api-zod workspace package imports it but doesn't bundle it).
