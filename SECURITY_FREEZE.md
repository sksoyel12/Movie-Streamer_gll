# 🔒 Security Freeze — S-Movie

## Overview

The files listed below contain the core security logic for the S-Movie
platform. They are **frozen** — no edits should be made without explicit
authorisation from the project owner.

---

## Security Override Code

To request edits to any frozen file, provide this code in your message:

```
SMOVIE-SEC-OVERRIDE-2026
```

The agent will **always ask for confirmation** before modifying any file
marked with the `⚠️ SECURITY FREEZE` header, even if the override code is
present.

---

## Frozen Files

| Layer | File | Purpose |
|-------|------|---------|
| **API — Auth** | `artifacts/api-server/src/middleware/firebaseAuth.ts` | Firebase JWT verification + 5-min cache |
| **API — Anti-bot** | `artifacts/api-server/src/middleware/antiBot.ts` | Bot UA block + missing-header honeypot |
| **API — Rate limit** | `artifacts/api-server/src/middleware/rateLimit.ts` | uid-keyed stream limiter + general limiter |
| **API — Honeypot** | `artifacts/api-server/src/middleware/honeypot.ts` | Decoy responses for unauthenticated calls |
| **API — VPN detect** | `artifacts/api-server/src/middleware/vpnDetect.ts` | VPN / proxy / datacenter IP block |
| **API — Req signature** | `artifacts/api-server/src/middleware/requestSignature.ts` | HMAC request signing + anti-replay |
| **API — Velocity** | `artifacts/api-server/src/middleware/velocityDetect.ts` | Per-device behavioral scraper detection |
| **API — Crypto** | `artifacts/api-server/src/lib/streamCrypto.ts` | AES-256-GCM URL encryption + key rotation |
| **API — Decoy gen** | `artifacts/api-server/src/lib/decoyGenerator.ts` | Fake-but-realistic honeypot JSON responses |
| **Mobile — API client** | `artifacts/s-movie/lib/apiClient.ts` | Auth headers, VPN error handling, signing |
| **Mobile — Signer** | `artifacts/s-movie/lib/requestSigner.ts` | Client-side HMAC request signing |
| **Mobile — Crypto** | `artifacts/s-movie/lib/streamCrypto.ts` | AES-256-GCM URL decryption |
| **Mobile — Device FP** | `artifacts/s-movie/lib/deviceFingerprint.ts` | Stable device fingerprint generation |
| **Mobile — Integrity** | `artifacts/s-movie/lib/integrityCheck.ts` | Emulator / jailbreak detection |
| **Mobile — VPN state** | `artifacts/s-movie/lib/vpnState.ts` | Global VPN block signal |

---

## Security Layers Summary

```
Incoming Request
      │
      ▼
┌─────────────┐   Bot UA or missing client header
│  antiBot    │──────────────────────────────────► Honeypot Decoy 200
└──────┬──────┘
       │
       ▼
┌─────────────┐   VPN / proxy / datacenter IP
│  vpnDetect  │──────────────────────────────────► 403 VPN_DETECTED
└──────┬──────┘
       │
       ▼
┌──────────────┐   No or invalid Firebase token
│ honeypotAuth │──────────────────────────────────► Honeypot Decoy 200
└──────┬───────┘
       │  (req.uid set)
       ▼
┌──────────────┐   X-S-Movie-Device velocity limit
│ velocityDetect│─────────────────────────────────► Honeypot Decoy 200
└──────┬───────┘
       │
       ▼
┌──────────────────┐   Missing / wrong HMAC sig or stale timestamp
│ requestSignature │──────────────────────────────► Honeypot Decoy 200
└──────┬───────────┘
       │
       ▼
┌──────────────┐   >30 req/min per uid
│ streamLimiter│──────────────────────────────────► 429 Too Many Requests
└──────┬───────┘
       │
       ▼
   Route Handler (real response)
```

---

## Change Protocol

1. Post `SMOVIE-SEC-OVERRIDE-2026` in the chat.
2. Describe exactly which file and what change.
3. Agent confirms the change with you before applying it.
4. After applying, the agent will update this document with the change log.

---

*Last updated: 2026-07-15*
