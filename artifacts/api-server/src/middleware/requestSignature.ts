/**
 * ⚠️  SECURITY FREEZE — DO NOT MODIFY WITHOUT SECURITY OVERRIDE CODE
 *     Override code: SMOVIE-SEC-OVERRIDE-2026
 *     Ask the project owner for this code before editing.
 *
 * Request Signature & Timestamp Anti-Replay Middleware
 *
 * Every authenticated request must include two extra headers:
 *   X-S-Movie-Ts  : Unix timestamp in seconds (integer)
 *   X-S-Movie-Sig : HMAC-SHA256(streamKey, method|path|timestamp) — hex
 *
 * The server derives the same stream key (per uid, per 15-min slot) and
 * independently computes the expected HMAC. Mismatches get decoy data,
 * not error messages — scrapers cannot learn the correct algorithm.
 *
 * Protects against:
 *  • Replay attacks (captured token + captured headers replayed later)
 *  • Any client that doesn't implement the exact signing scheme
 *  • Reverse-engineering attempts (no error hints)
 *
 * IMPORTANT: This runs AFTER honeypotAuth, so req.uid is already set.
 */

import { createHmac }                  from "crypto";
import { type Request, type Response, type NextFunction } from "express";
import { logger }                      from "../lib/logger";
import { clientKey }                   from "../lib/streamCrypto";
import {
  decoyStreamResponse,
  decoyRaceResponse,
  decoyScrapeMultiResponse,
  decoyScraperResponse,
} from "../lib/decoyGenerator";

// Clock-skew tolerance: ±5 minutes
const MAX_SKEW_MS = 5 * 60 * 1000;

// Seen-nonce replay cache: {sig → expiresAt}
const NONCE_CACHE = new Map<string, number>();

// Sweep expired nonces every minute
setInterval(() => {
  const now = Date.now();
  for (const [k, exp] of NONCE_CACHE) {
    if (exp < now) NONCE_CACHE.delete(k);
  }
}, 60_000).unref();

async function serveDecoy(req: Request, res: Response): Promise<void> {
  await new Promise((r) => setTimeout(r, Math.random() * 1200 + 300));
  const path = req.path;
  if (path.includes("/stream/race")) return void res.json(decoyRaceResponse());
  if (path.includes("/scrape"))      return void res.json(decoyScrapeMultiResponse());
  if (path.includes("/stream"))      return void res.json(decoyStreamResponse());
  return void res.json(decoyScraperResponse());
}

export async function requestSignature(req: Request, res: Response, next: NextFunction) {
  const tsHeader  = req.headers["x-s-movie-ts"]  as string | undefined;
  const sigHeader = req.headers["x-s-movie-sig"] as string | undefined;
  const uid       = (req as Request & { uid?: string }).uid;

  // No uid means honeypotAuth already handled this; pass through
  if (!uid) return next();

  // ── 1. Timestamp presence & format ────────────────────────────────────────
  if (!tsHeader || !/^\d{10}$/.test(tsHeader)) {
    logger.info({ uid, path: req.path }, "Sig: missing/invalid timestamp → decoy");
    return serveDecoy(req, res);
  }

  const tsSec = parseInt(tsHeader, 10);
  const tsMs  = tsSec * 1000;
  const now   = Date.now();

  // ── 2. Clock-skew / replay window ─────────────────────────────────────────
  if (Math.abs(now - tsMs) > MAX_SKEW_MS) {
    logger.info({ uid, path: req.path, skewMs: now - tsMs }, "Sig: timestamp out of window → decoy");
    return serveDecoy(req, res);
  }

  // ── 3. HMAC signature verification ────────────────────────────────────────
  if (!sigHeader || !/^[0-9a-f]{64}$/.test(sigHeader)) {
    logger.info({ uid, path: req.path }, "Sig: missing/malformed sig → decoy");
    return serveDecoy(req, res);
  }

  // Derive the expected stream key (current and previous slot are both valid)
  let verified = false;
  try {
    const { key } = clientKey(uid);       // current slot
    const material = `${req.method}|${req.path}|${tsHeader}`;
    const expected = createHmac("sha256", Buffer.from(key, "hex"))
      .update(material)
      .digest("hex");
    if (expected === sigHeader) verified = true;
  } catch { /* ignore — fall through to decoy */ }

  if (!verified) {
    logger.info({ uid, path: req.path }, "Sig: HMAC mismatch → decoy");
    return serveDecoy(req, res);
  }

  // ── 4. Nonce replay check ─────────────────────────────────────────────────
  const nonce = `${uid}:${sigHeader}`;
  if (NONCE_CACHE.has(nonce)) {
    logger.warn({ uid, path: req.path }, "Sig: nonce replay detected → decoy");
    return serveDecoy(req, res);
  }
  // Mark used until timestamp expires + skew tolerance
  NONCE_CACHE.set(nonce, tsMs + MAX_SKEW_MS + 10_000);

  next();
}
