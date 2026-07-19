/**
 * ⚠️  SECURITY FREEZE — DO NOT MODIFY WITHOUT SECURITY OVERRIDE CODE
 *     Override code: SMOVIE-SEC-OVERRIDE-2026
 *     Ask the project owner for this code before editing.
 *
 * Velocity / Behavioral Analysis Middleware
 *
 * Detects scraper-like traffic patterns that slip past IP-level blocks:
 *
 *   • Burst detection    — >60 requests in any 60-second sliding window
 *   • Stream hammering   — >15 distinct stream/scrape calls per minute
 *   • Emulator signal    — Device fingerprint contains "virtual"
 *   • New device burst   — Device seen <2 min ago making >30 calls
 *
 * Keyed by device fingerprint (X-S-Movie-Device header).
 * Violators receive honeypot decoy data — not 429 — to hide the detection.
 */

import { type Request, type Response, type NextFunction } from "express";
import { logger }                       from "../lib/logger";
import {
  decoyStreamResponse,
  decoyRaceResponse,
  decoyScrapeMultiResponse,
  decoyScraperResponse,
} from "../lib/decoyGenerator";

const WINDOW_MS          = 60_000;  // 1 minute sliding window
const MAX_REQS_PER_WINDOW = 60;
const MAX_STREAM_PER_WIN  = 15;

interface DeviceRecord {
  requests:     number[];   // timestamps of last N requests
  streamCalls:  number[];   // timestamps of stream/scrape requests
  firstSeen:    number;
  blocked:      boolean;
  blockedUntil: number;
}

const DEVICE_MAP = new Map<string, DeviceRecord>();

// Prune stale device records every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60_000;
  for (const [k, v] of DEVICE_MAP) {
    if (v.requests.at(-1) ?? 0 < cutoff) DEVICE_MAP.delete(k);
  }
}, 5 * 60_000).unref();

const STREAM_PATH_RE = /\/(stream|scrape|get-stream|vegamovies)/;

async function serveDecoy(req: Request, res: Response): Promise<void> {
  // Random delay to confuse timing analysis
  await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 1800) + 400));
  const path = req.path;
  if (path.includes("/stream/race")) return void res.json(decoyRaceResponse());
  if (path.includes("/scrape"))      return void res.json(decoyScrapeMultiResponse());
  if (path.includes("/stream"))      return void res.json(decoyStreamResponse());
  return void res.json(decoyScraperResponse());
}

export async function velocityDetect(req: Request, res: Response, next: NextFunction) {
  const fingerprint = req.headers["x-s-movie-device"] as string | undefined;

  // No fingerprint: can't track — but antiBot already caught missing client header
  if (!fingerprint || fingerprint === "pending") return next();

  const now = Date.now();

  // ── Emulator / virtual device signal ──────────────────────────────────────
  if (fingerprint.includes("virtual") || fingerprint === "pending") {
    logger.warn({ fp: fingerprint.slice(0, 12), path: req.path }, "Velocity: virtual device → decoy");
    return serveDecoy(req, res);
  }

  // ── Get/create device record ───────────────────────────────────────────────
  let rec = DEVICE_MAP.get(fingerprint);
  if (!rec) {
    rec = { requests: [], streamCalls: [], firstSeen: now, blocked: false, blockedUntil: 0 };
    DEVICE_MAP.set(fingerprint, rec);
  }

  // ── Check active block ─────────────────────────────────────────────────────
  if (rec.blocked && rec.blockedUntil > now) {
    return serveDecoy(req, res);
  }
  if (rec.blocked && rec.blockedUntil <= now) {
    rec.blocked = false;   // un-block after penalty period
    rec.requests = [];
    rec.streamCalls = [];
  }

  // ── Update sliding windows ─────────────────────────────────────────────────
  const windowStart = now - WINDOW_MS;
  rec.requests = [...rec.requests.filter((t) => t > windowStart), now];

  if (STREAM_PATH_RE.test(req.path)) {
    rec.streamCalls = [...rec.streamCalls.filter((t) => t > windowStart), now];
  }

  // ── Evaluate velocity thresholds ──────────────────────────────────────────
  const isNewDevice = (now - rec.firstSeen) < 2 * 60_000;
  const newDeviceBurst = isNewDevice && rec.requests.length > 30;

  const violation =
    rec.requests.length   > MAX_REQS_PER_WINDOW  ||
    rec.streamCalls.length > MAX_STREAM_PER_WIN    ||
    newDeviceBurst;

  if (violation) {
    rec.blocked      = true;
    rec.blockedUntil = now + 10 * 60_000;  // 10-min penalty
    logger.warn({
      fp:         fingerprint.slice(0, 12),
      reqs:       rec.requests.length,
      streamCalls: rec.streamCalls.length,
      newDevice:  isNewDevice,
      path:       req.path,
    }, "Velocity: scraper pattern detected → decoy");
    return serveDecoy(req, res);
  }

  next();
}
