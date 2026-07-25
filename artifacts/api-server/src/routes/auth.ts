import { Router, type Request } from "express";
import {
  sendWelcomeEmail,
  sendOtpEmail,
  sendLoginNotificationEmail,
  sendGoodbyeEmail,
} from "../utils/emailSender";
import { logger } from "../lib/logger";

const authRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.includes("@") && value.length > 3;
}

function extractIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0]?.trim() ?? "Unknown";
  return req.socket?.remoteAddress ?? "Unknown";
}

function formatTime(date: Date): string {
  return date.toUTCString().replace("GMT", "UTC");
}

// ---------------------------------------------------------------------------
// POST /api/auth/welcome-email
// ---------------------------------------------------------------------------

authRouter.post("/auth/welcome-email", async (req, res) => {
  const { email, displayName } = req.body as { email?: unknown; displayName?: unknown };
  if (!validEmail(email)) {
    res.status(400).json({ success: false, message: "Valid email required." });
    return;
  }
  logger.info({ email }, "Welcome email requested");
  await sendWelcomeEmail(email, typeof displayName === "string" ? displayName : undefined);
  res.status(200).json({ success: true, message: "Welcome email dispatched." });
});

// ---------------------------------------------------------------------------
// POST /api/auth/send-otp
// ---------------------------------------------------------------------------

authRouter.post("/auth/send-otp", async (req, res) => {
  const { email, otp, expiryMinutes } = req.body as { email?: unknown; otp?: unknown; expiryMinutes?: unknown };
  if (!validEmail(email)) {
    res.status(400).json({ success: false, message: "Valid email required." });
    return;
  }
  if (typeof otp !== "string" || !/^\d{4,8}$/.test(otp)) {
    res.status(400).json({ success: false, message: "otp must be a 4–8 digit string." });
    return;
  }
  const expiry = typeof expiryMinutes === "number" && expiryMinutes > 0 ? expiryMinutes : 5;
  logger.info({ email }, "OTP email requested");
  await sendOtpEmail(email, otp, expiry);
  res.status(200).json({ success: true, message: "OTP email dispatched." });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login-notification
// Accepts: { email, deviceName?, platform?, posterUrl?, movieTitle? }
// ---------------------------------------------------------------------------

authRouter.post("/auth/login-notification", async (req, res) => {
  const { email, deviceName, platform, posterUrl, movieTitle } = req.body as {
    email?: unknown; deviceName?: unknown; platform?: unknown;
    posterUrl?: unknown; movieTitle?: unknown;
  };
  if (!validEmail(email)) {
    res.status(400).json({ success: false, message: "Valid email required." });
    return;
  }

  const ip       = extractIp(req);
  const device   = [
    typeof deviceName === "string" && deviceName ? deviceName : null,
    typeof platform   === "string" && platform   ? platform   : null,
  ].filter(Boolean).join(" · ") || "Unknown Device";

  logger.info({ email, device, ip }, "Login notification requested");

  await sendLoginNotificationEmail({
    recipientEmail:  email,
    deviceName:      device,
    loginTime:       formatTime(new Date()),
    location:        ip !== "Unknown" ? `IP: ${ip}` : "Unknown Location",
    posterUrl:       typeof posterUrl   === "string" ? posterUrl   : null,
    movieTitle:      typeof movieTitle  === "string" ? movieTitle  : null,
    secureAccountUrl: process.env["APP_URL"],
  });

  res.status(200).json({ success: true, message: "Login notification dispatched." });
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout-notification
// Accepts: { email, displayName? }
// ---------------------------------------------------------------------------

authRouter.post("/auth/logout-notification", async (req, res) => {
  const { email, displayName } = req.body as { email?: unknown; displayName?: unknown };
  if (!validEmail(email)) {
    res.status(400).json({ success: false, message: "Valid email required." });
    return;
  }
  logger.info({ email }, "Logout / goodbye email requested");
  await sendGoodbyeEmail(email, typeof displayName === "string" ? displayName : null);
  res.status(200).json({ success: true, message: "Goodbye email dispatched." });
});

export default authRouter;
