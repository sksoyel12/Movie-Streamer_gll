import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, duplicateAttemptsTable, identityVerificationsTable } from "@workspace/db";
import { requireAuth } from "../middleware/firebaseAuth";
import { authLimiter } from "../middleware/rateLimit";
import { generateUniqueUserId } from "../lib/uniqueId";
import { analyzeIdPhoto } from "../lib/identityAnalysis";
import { invalidateSuspensionCache } from "../middleware/blockSuspended";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const MAX_ID_GENERATION_ATTEMPTS = 5;

async function insertUserWithUniqueId(row: {
  firebaseUid: string;
  email?: string | null;
  displayName?: string | null;
  photoUrl?: string | null;
  deviceFingerprint?: string | null;
}) {
  for (let attempt = 0; attempt < MAX_ID_GENERATION_ATTEMPTS; attempt++) {
    const uniqueUserId = generateUniqueUserId();
    try {
      const [inserted] = await db
        .insert(usersTable)
        .values({ ...row, uniqueUserId })
        .returning();
      return inserted;
    } catch (err: any) {
      // Postgres unique_violation — retry with a freshly generated ID.
      if (err?.code === "23505" && String(err?.detail ?? "").includes("unique_user_id")) {
        continue;
      }
      throw err;
    }
  }
  throw new Error("Could not generate a unique user ID after several attempts");
}

/**
 * POST /api/identity/google-sync
 * Authorization: Bearer <Firebase ID Token>
 * Body: { email?, displayName?, photoUrl?, deviceFingerprint? }
 *
 * Called right after a successful Google Sign-In. Creates the permanent
 * S-Movie user record (with its unique ID) on first sign-up, or returns the
 * existing one on subsequent sign-ins.
 *
 * If a *different* Firebase account tries to sign up from a device already
 * tied to an existing user, the attempt is logged and rejected as a
 * duplicate — no second ID is created for that identity.
 */
router.post("/identity/google-sync", authLimiter, requireAuth, async (req, res) => {
  const uid = (req as any).uid as string;
  const { email, displayName, photoUrl, deviceFingerprint } = req.body as {
    email?: string;
    displayName?: string;
    photoUrl?: string;
    deviceFingerprint?: string;
  };

  try {
    const existingRows = await db.select().from(usersTable).where(eq(usersTable.firebaseUid, uid)).limit(1);
    if (existingRows[0]) {
      const existing = existingRows[0];
      const [updated] = await db
        .update(usersTable)
        .set({
          email: email ?? existing.email,
          displayName: displayName ?? existing.displayName,
          photoUrl: photoUrl ?? existing.photoUrl,
          deviceFingerprint: deviceFingerprint ?? existing.deviceFingerprint,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, existing.id))
        .returning();
      res.json(toPublicUser(updated));
      return;
    }

    // ── Duplicate-identity check ──────────────────────────────────────────
    // Google guarantees unique emails per account, so the only cross-account
    // signal available here is the device fingerprint sent by the client.
    if (deviceFingerprint) {
      const matches = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.deviceFingerprint, deviceFingerprint))
        .limit(1);

      const matched = matches[0];
      if (matched && matched.firebaseUid !== uid) {
        await db.insert(duplicateAttemptsTable).values({
          attemptedFirebaseUid: uid,
          attemptedEmail: email ?? null,
          matchedUserId: matched.id,
          deviceFingerprint,
        });
        logger.warn(
          { uid, matchedUserId: matched.id, deviceFingerprint },
          "[identity] Duplicate Attempt blocked",
        );
        res.status(409).json({
          error:
            "This device is already linked to another S-Movie account. Please sign in with your existing account instead.",
          code: "DUPLICATE_ATTEMPT",
        });
        return;
      }
    }

    const created = await insertUserWithUniqueId({
      firebaseUid: uid,
      email: email ?? null,
      displayName: displayName ?? null,
      photoUrl: photoUrl ?? null,
      deviceFingerprint: deviceFingerprint ?? null,
    });
    res.status(201).json(toPublicUser(created));
  } catch (err) {
    logger.error({ err }, "[identity] google-sync failed");
    res.status(500).json({ error: "Could not sync account. Please try again." });
  }
});

/**
 * GET /api/identity/me
 * Authorization: Bearer <Firebase ID Token>
 *
 * Returns the caller's S-Movie identity record (unique ID, verification
 * status, suspension state). 404 if google-sync hasn't run yet for this uid.
 */
router.get("/identity/me", requireAuth, async (req, res) => {
  const uid = (req as any).uid as string;
  try {
    const rows = await db.select().from(usersTable).where(eq(usersTable.firebaseUid, uid)).limit(1);
    if (!rows[0]) {
      res.status(404).json({ error: "No identity record for this account yet." });
      return;
    }
    res.json(toPublicUser(rows[0]));
  } catch (err) {
    logger.error({ err }, "[identity] /me failed");
    res.status(500).json({ error: "Could not load account." });
  }
});

/**
 * POST /api/identity/verify-photo
 * Authorization: Bearer <Firebase ID Token>
 * Body: { imageBase64: string, mimeType?: string }
 *
 * Runs automated blur/tamper/fake-ID detection on the submitted photo ID.
 * On a failed check, the account is immediately suspended (isSuspended=true)
 * and all streaming/API access is blocked until support clears it.
 */
router.post("/identity/verify-photo", authLimiter, requireAuth, async (req, res) => {
  const uid = (req as any).uid as string;
  const { imageBase64, mimeType } = req.body as { imageBase64?: string; mimeType?: string };

  if (!imageBase64 || typeof imageBase64 !== "string") {
    res.status(400).json({ error: "imageBase64 is required" });
    return;
  }
  // Rough sanity cap (~8MB base64) to avoid abuse via oversized payloads.
  if (imageBase64.length > 11_000_000) {
    res.status(413).json({ error: "Image is too large." });
    return;
  }

  try {
    const rows = await db.select().from(usersTable).where(eq(usersTable.firebaseUid, uid)).limit(1);
    const user = rows[0];
    if (!user) {
      res.status(404).json({ error: "No identity record for this account yet. Sign in again first." });
      return;
    }

    const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",").pop()! : imageBase64;
    const verdict = await analyzeIdPhoto(cleanBase64, mimeType || "image/jpeg");

    const status = verdict.passed ? "approved" : "rejected";
    let suspensionReason: string | null = null;
    if (!verdict.passed) {
      if (verdict.isDocument === "no") suspensionReason = "The submitted photo does not appear to be a government ID.";
      else if (verdict.tampered === "yes") suspensionReason = "The submitted ID appears to be edited or tampered with.";
      else if (verdict.fakeId === "yes") suspensionReason = "The submitted ID could not be verified as authentic.";
      else if (verdict.blurry === "yes") suspensionReason = "The submitted ID photo was too blurry to verify.";
      else suspensionReason = "Your ID could not be automatically verified.";
    }

    await db.insert(identityVerificationsTable).values({
      userId: user.id,
      status,
      rejectionReason: suspensionReason,
      blurScore: verdict.blurScore,
      tampered: verdict.tampered,
      fakeId: verdict.fakeId,
      analysis: verdict as unknown as Record<string, unknown>,
    });

    const [updated] = await db
      .update(usersTable)
      .set({
        verificationStatus: verdict.passed ? "verified" : "rejected",
        isSuspended: !verdict.passed,
        suspensionReason,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id))
      .returning();

    invalidateSuspensionCache(uid);

    res.json({
      verificationStatus: updated.verificationStatus,
      isSuspended: updated.isSuspended,
      suspensionReason: updated.suspensionReason,
      reason: verdict.reason,
    });
  } catch (err) {
    logger.error({ err }, "[identity] verify-photo failed");
    res.status(500).json({ error: "Could not process the photo. Please try again." });
  }
});

function toPublicUser(row: typeof usersTable.$inferSelect) {
  return {
    uniqueUserId: row.uniqueUserId,
    email: row.email,
    displayName: row.displayName,
    photoUrl: row.photoUrl,
    isSuspended: row.isSuspended,
    suspensionReason: row.suspensionReason,
    verificationStatus: row.verificationStatus,
  };
}

export default router;
