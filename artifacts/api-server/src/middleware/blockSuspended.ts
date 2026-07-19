/**
 * Suspension gate.
 *
 * Sits after honeypotAuth/requireAuth (both attach `req.uid`) and before the
 * real route handlers. Suspended accounts get a polite 403 instead of
 * streaming data or any other protected API response.
 *
 * Results are cached briefly per-uid to avoid a DB round trip on every
 * request; verification/suspension actions invalidate the cache immediately.
 */

import { type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";

interface CacheEntry {
  isSuspended: boolean;
  reason: string | null;
  expiresAt: number;
}

const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 1000; // 30s — short so a fresh suspension takes effect quickly

export function invalidateSuspensionCache(firebaseUid: string): void {
  CACHE.delete(firebaseUid);
}

async function isSuspended(firebaseUid: string): Promise<{ isSuspended: boolean; reason: string | null }> {
  const cached = CACHE.get(firebaseUid);
  if (cached && Date.now() < cached.expiresAt) return cached;

  try {
    const rows = await db
      .select({ isSuspended: usersTable.isSuspended, suspensionReason: usersTable.suspensionReason })
      .from(usersTable)
      .where(eq(usersTable.firebaseUid, firebaseUid))
      .limit(1);

    const result = {
      isSuspended: rows[0]?.isSuspended ?? false,
      reason: rows[0]?.suspensionReason ?? null,
    };
    CACHE.set(firebaseUid, { ...result, expiresAt: Date.now() + CACHE_TTL });
    return result;
  } catch (err) {
    logger.warn({ err }, "[blockSuspended] DB lookup failed — failing open");
    // Fail open: a DB hiccup should not take down streaming for everyone.
    return { isSuspended: false, reason: null };
  }
}

export async function blockSuspended(req: Request, res: Response, next: NextFunction) {
  const uid = (req as any).uid as string | undefined;
  if (!uid) { next(); return; } // no authenticated uid — let downstream auth handle it

  const { isSuspended: suspended, reason } = await isSuspended(uid);
  if (suspended) {
    res.status(403).json({
      error: reason || "Your account is under verification. Please check back shortly.",
      code: "ACCOUNT_SUSPENDED",
    });
    return;
  }
  next();
}
