/**
 * ⚠️  SECURITY FREEZE — DO NOT MODIFY WITHOUT SECURITY OVERRIDE CODE
 *     Override code: SMOVIE-SEC-OVERRIDE-2026
 *     Ask the project owner for this code before editing.
 *
 * Rate-limiting configuration for the S-Movie API.
 *
 * Tiers:
 *   streamLimiter  — 30 req / 60s  (stream/scrape endpoints)
 *   generalLimiter — 120 req / 60s (everything else)
 *   authLimiter    — 10 req / 60s  (auth endpoints, prevents OTP abuse)
 */

import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const windowMs = 60 * 1000; // 1 minute

/** Stream and scraper endpoints — tightest limit */
export const streamLimiter = rateLimit({
  windowMs,
  max: 30,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: "Too many requests. Please wait a moment.", code: "RATE_LIMITED" },
  keyGenerator:    (req) => {
    // All requests reaching streamLimiter have already passed requireAuth,
    // so uid is always present. Key by uid; fall back to normalized IP.
    const uid = (req as any).uid as string | undefined;
    return uid ? `uid:${uid}` : ipKeyGenerator(req.ip ?? "");
  },
});

/** General API endpoints — high limit to accommodate image/TMDB proxy traffic */
export const generalLimiter = rateLimit({
  windowMs,
  max:             1000,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: "Too many requests. Please slow down.", code: "RATE_LIMITED" },
});

/** Auth endpoints — prevent OTP spam */
export const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: "Too many auth attempts. Please wait 15 minutes.", code: "AUTH_RATE_LIMITED" },
  skipSuccessfulRequests: false,
});
