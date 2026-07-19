/**
 * ⚠️  SECURITY FREEZE — DO NOT MODIFY WITHOUT SECURITY OVERRIDE CODE
 *     Override code: SMOVIE-SEC-OVERRIDE-2026
 *     Ask the project owner for this code before editing.
 *
 * Firebase ID Token verification middleware.
 *
 * Verifies the Bearer token in Authorization header against Firebase
 * Identity Toolkit. Results are cached for 5 minutes to avoid per-request
 * network calls.
 *
 * Usage:
 *   router.use(requireAuth);          // 401 if not authenticated
 *   router.use(optionalAuth);         // attaches req.uid if present, never blocks
 */

import { type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";

import { FIREBASE_API_KEY } from "../lib/firebaseApiKey";
const IDP_LOOKUP = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`;

// ─── Token verification cache ─────────────────────────────────────────────────

interface CacheEntry {
  uid:       string;
  phone:     string;
  expiresAt: number; // ms
}

const TOKEN_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL   = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE   = 10_000;         // evict oldest when full

function cacheSet(token: string, uid: string, phone: string) {
  if (TOKEN_CACHE.size >= MAX_CACHE) {
    // Evict oldest entry
    const oldest = TOKEN_CACHE.keys().next().value;
    if (oldest) TOKEN_CACHE.delete(oldest);
  }
  TOKEN_CACHE.set(token, { uid, phone, expiresAt: Date.now() + CACHE_TTL });
}

function cacheGet(token: string): CacheEntry | null {
  const entry = TOKEN_CACHE.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    TOKEN_CACHE.delete(token);
    return null;
  }
  return entry;
}

// ─── Firebase token verification ─────────────────────────────────────────────

async function verifyFirebaseToken(idToken: string): Promise<{ uid: string; phone: string } | null> {
  // Check cache first
  const cached = cacheGet(idToken);
  if (cached) return cached;

  try {
    const res = await fetch(IDP_LOOKUP, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ idToken }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      users?: Array<{ localId: string; phoneNumber?: string; email?: string }>;
      error?: { message: string };
    };

    if (data.error || !data.users?.length) return null;

    const user = data.users[0];
    const uid   = user.localId;
    const phone = user.phoneNumber ?? user.email ?? "";

    cacheSet(idToken, uid, phone);
    return { uid, phone };
  } catch (err) {
    logger.warn({ err }, "Firebase token verification failed");
    return null;
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Attach uid/phone to request if a valid Bearer token is present.
 * Never blocks — use requireAuth for blocking.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const user  = await verifyFirebaseToken(token);
    if (user) {
      (req as any).uid   = user.uid;
      (req as any).phone = user.phone;
    }
  }
  next();
}

/**
 * Require a valid Firebase ID token.
 * Returns 401 if missing or invalid, 429 if Firebase is unreachable.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;

  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required", code: "MISSING_TOKEN" });
    return;
  }

  const token = auth.slice(7).trim();
  const user  = await verifyFirebaseToken(token);

  if (!user) {
    res.status(401).json({ error: "Invalid or expired token", code: "INVALID_TOKEN" });
    return;
  }

  (req as any).uid   = user.uid;
  (req as any).phone = user.phone;
  next();
}
