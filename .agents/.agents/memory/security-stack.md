---
name: Full Security Stack
description: Complete S-Movie security architecture — all layers, frozen files, and override protocol
---

## Security Layers (API Server — in order)

1. **antiBot** — bot UA block; missing/invalid X-S-Movie-Client header → honeypot decoy 200 (not 403)
2. **vpnDetect** — VPN/proxy/datacenter IP → 403 VPN_DETECTED (fails open if ip-api.com is down)
3. **honeypotAuth** — Firebase JWT verify; no/bad token → honeypot decoy 200; valid token sets req.uid
4. **velocityDetect** — per device-fingerprint sliding window: >60 req/min OR >15 stream calls/min OR new device burst → decoy + 10-min block. Virtual device fingerprint → immediate decoy.
5. **requestSignature** — HMAC-SHA256(streamKey, METHOD|path|unixSecs) + 5-min timestamp window + nonce replay cache → decoy on any mismatch
6. **streamLimiter** — express-rate-limit, 30 req/min per uid, hard 429

## Mobile Security Layers

- **deviceFingerprint** — SHA-256(randomDeviceId + brand + model + OS + type) sent as X-S-Movie-Device
- **requestSigner** — HMAC-SHA256(streamKey, METHOD|path|ts) via crypto.subtle; sets X-S-Movie-Ts + X-S-Movie-Sig
- **integrityCheck** — expo-device: emulator/known-emulator-brand detection → IntegrityBlockModal (non-dismissable)
- **vpnState** — global observable; apiClient signals VPN_DETECTED → VpnBlockModal shown from root layout
- **apiClient** — injects all security headers; clears signing key on sign-out

## Signing Key Flow

1. User authenticates via Firebase Phone OTP
2. Client POSTs to /api/auth/stream-key (auth-gated, no sig required for this endpoint)
3. Server returns { key: hex, expiresAt } derived from HMAC-SHA256(SESSION_SECRET, uid+slot)
4. Client stores key via setStreamKey() + setSigningKey() (same key for decrypt + HMAC signing)
5. All subsequent protected requests include X-S-Movie-Ts + X-S-Movie-Sig
6. Key rotates every 15 min; server accepts current + 2 previous slots

## Security Freeze

Override code: SMOVIE-SEC-OVERRIDE-2026
Frozen files documented in SECURITY_FREEZE.md at repo root.
Agent must ask for explicit confirmation before editing any file with the SECURITY FREEZE header.

**Why:** All security layers are interdependent. Editing one without understanding the others could break honeypot/decoy behavior or introduce a bypass.
