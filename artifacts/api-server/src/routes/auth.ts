import { Router, type Request } from "express";
import { sendWelcomeEmail, sendOtpEmail, sendLoginNotificationEmail } from "../utils/emailSender";
import { logger } from "../lib/logger";

const authRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.includes("@") && value.length > 3;
}

/** Best-effort IP extraction (handles Replit proxy headers). */
function extractIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() ?? "Unknown";
  return req.socket?.remoteAddress ?? "Unknown";
}

/** Format a Date into a human-readable string like "25 Jul 2026, 07:08 UTC". */
function formatTime(date: Date): string {
  return date.toUTCString().replace("GMT", "UTC");
}

// ---------------------------------------------------------------------------
// POST /api/auth/welcome-email
// Called by the mobile app immediately after a new Firebase account is created.
// ---------------------------------------------------------------------------

authRouter.post("/auth/welcome-email", async (req, res) => {
  const { email, displayName } = req.body as { email?: unknown; displayName?: unknown };

  if (!validEmail(email)) {
    res.status(400).json({ success: false, message: "A valid email address is required." });
    return;
  }

  logger.info({ email }, "Welcome email requested");

  // Always best-effort — never blocks registration
  await sendWelcomeEmail(email, typeof displayName === "string" ? displayName : undefined);

  res.status(200).json({ success: true, message: "Welcome email dispatched." });
});

// ---------------------------------------------------------------------------
// POST /api/auth/send-otp
// Accepts { email, otp, expiryMinutes? } — caller generates and owns the OTP.
// Server only sends the styled email.
// ---------------------------------------------------------------------------

authRouter.post("/auth/send-otp", async (req, res) => {
  const { email, otp, expiryMinutes } = req.body as {
    email?: unknown;
    otp?: unknown;
    expiryMinutes?: unknown;
  };

  if (!validEmail(email)) {
    res.status(400).json({ success: false, message: "A valid email address is required." });
    return;
  }

  // OTP must be a non-empty string of digits
  if (typeof otp !== "string" || !/^\d{4,8}$/.test(otp)) {
    res.status(400).json({ success: false, message: "otp must be a 4–8 digit numeric string." });
    return;
  }

  const expiry = typeof expiryMinutes === "number" && expiryMinutes > 0 ? expiryMinutes : 5;

  logger.info({ email }, "OTP email requested");

  await sendOtpEmail(email, otp, expiry);

  res.status(200).json({ success: true, message: "OTP email dispatched." });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login-notification
// Called by the mobile app on every successful login (non-first-time users).
// ---------------------------------------------------------------------------

authRouter.post("/auth/login-notification", async (req, res) => {
  const { email, deviceName, platform } = req.body as {
    email?: unknown;
    deviceName?: unknown;
    platform?: unknown;
  };

  if (!validEmail(email)) {
    res.status(400).json({ success: false, message: "A valid email address is required." });
    return;
  }

  const ip          = extractIp(req);
  const loginTime   = formatTime(new Date());
  const device      = [
    typeof deviceName === "string" && deviceName ? deviceName : null,
    typeof platform  === "string" && platform   ? platform  : null,
  ].filter(Boolean).join(" · ") || "Unknown Device";

  logger.info({ email, device, ip }, "Login notification requested");

  await sendLoginNotificationEmail({
    recipientEmail:  email,
    deviceName:      device,
    loginTime,
    location:        ip !== "Unknown" ? `IP: ${ip}` : "Unknown Location",
    secureAccountUrl: process.env["APP_URL"] ?? undefined,
  });

  res.status(200).json({ success: true, message: "Login notification dispatched." });
});

export default authRouter;
