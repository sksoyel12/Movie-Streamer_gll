import { Router } from "express";
import { requireAuth } from "../middleware/firebaseAuth";
import { authLimiter } from "../middleware/rateLimit";
import { clientKey }   from "../lib/streamCrypto";
import { blockSuspended } from "../middleware/blockSuspended";

const router: Router = Router();

import { FIREBASE_API_KEY } from "../lib/firebaseApiKey";
const IDP_BASE = "https://identitytoolkit.googleapis.com/v1/accounts";

/**
 * POST /api/auth/phone/send
 * Body: { phoneNumber: "+91XXXXXXXXXX" }
 *
 * Sends an OTP via Firebase Identity Toolkit.
 * Returns: { sessionInfo: string }
 */
router.post("/auth/phone/send", authLimiter, async (req, res) => {
  const { phoneNumber, recaptchaToken } = req.body as {
    phoneNumber?: string;
    recaptchaToken?: string;
  };

  if (!phoneNumber || typeof phoneNumber !== "string") {
    res.status(400).json({ error: "phoneNumber is required" });
    return;
  }

  try {
    const payload: Record<string, string> = { phoneNumber };
    if (recaptchaToken) payload.recaptchaToken = recaptchaToken;

    const fbRes = await fetch(
      `${IDP_BASE}:sendVerificationCode?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    const data = (await fbRes.json()) as {
      sessionInfo?: string;
      error?: { message?: string; code?: number };
    };

    if (!fbRes.ok || data.error) {
      const msg = data.error?.message ?? `Firebase error ${fbRes.status}`;
      res.status(fbRes.ok ? 400 : fbRes.status).json({ error: msg });
      return;
    }

    res.json({ sessionInfo: data.sessionInfo });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Server error: ${msg}` });
  }
});

/**
 * POST /api/auth/phone/verify
 * Body: { sessionInfo: string, code: string }
 *
 * Verifies the OTP and returns Firebase user info.
 * Returns: { uid, idToken, phoneNumber, isNewUser }
 */
router.post("/auth/phone/verify", authLimiter, async (req, res) => {
  const { sessionInfo, code } = req.body as {
    sessionInfo?: string;
    code?: string;
  };

  if (!sessionInfo || !code) {
    res.status(400).json({ error: "sessionInfo and code are required" });
    return;
  }

  try {
    const fbRes = await fetch(
      `${IDP_BASE}:signInWithPhoneNumber?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionInfo, code }),
      },
    );

    const data = (await fbRes.json()) as {
      idToken?: string;
      localId?: string;
      phoneNumber?: string;
      isNewUser?: boolean;
      error?: { message?: string; code?: number };
    };

    if (!fbRes.ok || data.error) {
      const msg = data.error?.message ?? `Firebase error ${fbRes.status}`;
      res.status(fbRes.ok ? 400 : fbRes.status).json({ error: msg });
      return;
    }

    res.json({
      uid: data.localId,
      idToken: data.idToken,
      phoneNumber: data.phoneNumber,
      isNewUser: data.isNewUser ?? false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Server error: ${msg}` });
  }
});

/**
 * POST /api/auth/stream-key
 * Authorization: Bearer <Firebase ID Token>
 *
 * Returns a time-scoped AES-256-GCM key for decrypting stream URLs.
 * The key is derived from SESSION_SECRET + uid + current hour slot.
 * Clients should cache it until expiresAt and refresh before it expires.
 *
 * Returns: { key: "<64-char hex>", expiresAt: <unix ms> }
 */
router.post("/auth/stream-key", requireAuth, blockSuspended, (req, res) => {
  const uid = (req as any).uid as string;
  const { key, expiresAt } = clientKey(uid);
  res.json({ key, expiresAt });
});

export default router;
