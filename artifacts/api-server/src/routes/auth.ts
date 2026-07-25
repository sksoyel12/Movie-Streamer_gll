import { Router, type Request } from "express";
import {
  sendWelcomeEmail,
  sendOtpEmail,
  sendLoginNotificationEmail,
  sendGoodbyeEmail,
} from "../utils/emailSender";
import {
  getTrendingMovie,
  getNewReleaseMovie,
  tmdbPosterUrl,
} from "../lib/firestoreData";
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

/** Fetch a featured movie poster — tries new release first, falls back to trending. */
async function getFeaturedPoster(): Promise<{ posterUrl: string | null; movieTitle: string | null }> {
  try {
    const [newRelease, trending] = await Promise.all([getNewReleaseMovie(), getTrendingMovie()]);
    const movie = newRelease ?? trending;
    if (!movie) return { posterUrl: null, movieTitle: null };
    return {
      posterUrl:  movie.posterPath ? tmdbPosterUrl(movie.posterPath, "w780") : null,
      movieTitle: movie.title || null,
    };
  } catch {
    return { posterUrl: null, movieTitle: null };
  }
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

  // Fetch a featured movie poster to make the welcome email dynamic
  const { posterUrl, movieTitle } = await getFeaturedPoster();

  await sendWelcomeEmail(
    email,
    typeof displayName === "string" ? displayName : undefined,
    posterUrl,
    movieTitle,
  );
  res.status(200).json({ success: true, message: "Welcome email dispatched." });
});

// ---------------------------------------------------------------------------
// POST /api/auth/send-otp
// Sends OTP to the USER's email address (from req.body.email — never EMAIL_USER)
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
  logger.info({ recipientEmail: email }, "OTP email requested → sending to user email");
  // email here is the USER's email — never EMAIL_USER
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

  const ip     = extractIp(req);
  const device = [
    typeof deviceName === "string" && deviceName ? deviceName : null,
    typeof platform   === "string" && platform   ? platform   : null,
  ].filter(Boolean).join(" · ") || "Unknown Device";

  // If no poster was passed from the client, fetch a featured one dynamically
  let resolvedPosterUrl  = typeof posterUrl  === "string" ? posterUrl  : null;
  let resolvedMovieTitle = typeof movieTitle === "string" ? movieTitle : null;
  if (!resolvedPosterUrl) {
    const featured = await getFeaturedPoster();
    resolvedPosterUrl  = featured.posterUrl;
    resolvedMovieTitle = resolvedMovieTitle ?? featured.movieTitle;
  }

  logger.info({ email, device, ip }, "Login notification requested");

  await sendLoginNotificationEmail({
    recipientEmail:  email,
    deviceName:      device,
    loginTime:       formatTime(new Date()),
    location:        ip !== "Unknown" ? `IP: ${ip}` : "Unknown Location",
    posterUrl:       resolvedPosterUrl,
    movieTitle:      resolvedMovieTitle,
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

  // Fetch a featured movie poster dynamically for the goodbye email
  const { posterUrl, movieTitle } = await getFeaturedPoster();

  await sendGoodbyeEmail(
    email,
    typeof displayName === "string" ? displayName : null,
    posterUrl,
    movieTitle,
  );
  res.status(200).json({ success: true, message: "Goodbye email dispatched." });
});

export default authRouter;
