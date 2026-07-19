/**
 * ⚠️  SECURITY FREEZE — DO NOT MODIFY WITHOUT SECURITY OVERRIDE CODE
 *     Override code: SMOVIE-SEC-OVERRIDE-2026
 *     Ask the project owner for this code before editing.
 *
 * Honeypot Authentication Middleware
 *
 * Replaces the hard 401 "Authentication required" response with a realistic-
 * looking decoy response for unauthenticated requests. Scrapers who managed
 * to reverse-engineer the client header will receive beautiful, well-formed
 * JSON responses — with URLs that are AES-encrypted with a discarded key
 * and will never play.
 *
 * Real authenticated users pass through to the actual route handler.
 *
 * Middleware order (replaces requireAuth in the protected stack):
 *   antiBot → honeypotAuth → streamLimiter → [route handler]
 *
 * Route-specific decoy selection is done by inspecting req.path.
 */

import { type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";
import {
  decoyStreamResponse,
  decoyRaceResponse,
  decoyScraperResponse,
  decoyScrapeMultiResponse,
} from "../lib/decoyGenerator";

// Re-use the Firebase token cache from firebaseAuth for verification
import { FIREBASE_API_KEY } from "../lib/firebaseApiKey";
const IDP_LOOKUP = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`;

interface TokenCacheEntry {
  uid:       string;
  phone:     string;
  expiresAt: number;
}

// Shared token cache (shared state with firebaseAuth if needed, kept local here)
const TOKEN_CACHE = new Map<string, TokenCacheEntry>();
const CACHE_TTL   = 5 * 60 * 1000;

async function verifyToken(idToken: string): Promise<{ uid: string; phone: string } | null> {
  const cached = TOKEN_CACHE.get(idToken);
  if (cached && Date.now() < cached.expiresAt) return cached;

  try {
    const res = await fetch(IDP_LOOKUP, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ idToken }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      users?: Array<{ localId: string; phoneNumber?: string; email?: string }>;
      error?: unknown;
    };
    if (data.error || !data.users?.length) return null;

    const user = data.users[0];
    const entry: TokenCacheEntry = {
      uid:       user.localId,
      phone:     user.phoneNumber ?? user.email ?? "",
      expiresAt: Date.now() + CACHE_TTL,
    };
    TOKEN_CACHE.set(idToken, entry);
    return entry;
  } catch {
    return null;
  }
}

// ─── Decoy router ─────────────────────────────────────────────────────────────

function serveDecoy(req: Request, res: Response) {
  const path = req.path;
  logger.info({ path, ip: req.ip }, "Honeypot: serving decoy response");

  // Add a small randomised delay to simulate real scraping latency
  const delay = Math.floor(Math.random() * 2000) + 500;

  setTimeout(() => {
    if (path.includes("/stream/race")) {
      res.json(decoyRaceResponse());
    } else if (path.includes("/scrape")) {
      res.json(decoyScrapeMultiResponse());
    } else if (path.includes("/stream")) {
      res.json(decoyStreamResponse());
    } else {
      // /get-stream, /vegamovies, or anything else
      res.json(decoyScraperResponse());
    }
  }, delay);
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Drop-in replacement for `requireAuth` on protected routes.
 *
 * Valid token  → passes req.uid/phone to next middleware (real handler)
 * Missing/bad  → serves decoy data (honeypot, no error code exposed)
 */
export async function honeypotAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;

  if (!auth?.startsWith("Bearer ")) {
    return serveDecoy(req, res);
  }

  const token = auth.slice(7).trim();
  const user  = await verifyToken(token);

  if (!user) {
    return serveDecoy(req, res);
  }

  (req as any).uid   = user.uid;
  (req as any).phone = user.phone;
  next();
}
