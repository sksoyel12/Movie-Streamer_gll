import nodemailer from "nodemailer";
import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Transporter
// ---------------------------------------------------------------------------

function createTransporter() {
  const user = process.env["EMAIL_USER"];
  const pass = process.env["EMAIL_PASS"];
  if (!user || !pass)
    throw new Error("EMAIL_USER and EMAIL_PASS must be set to send emails.");
  return nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
}

const SENDER_NAME  = "S-MOVIE ORIGINAL";
const APP_URL      = () => process.env["APP_URL"] ?? "https://s-movie.replit.app";
const SENDER_EMAIL = () => process.env["EMAIL_USER"] ?? "";

// ---------------------------------------------------------------------------
// Shared layout shell
// ---------------------------------------------------------------------------

const BASE_STYLES = `body{margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;}table{border-collapse:collapse;}a{text-decoration:none;}img{display:block;border:0;}`;

function emailShell(bodyContent: string): string {
  return /* html */`<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta name="color-scheme" content="dark"/><meta name="supported-color-schemes" content="dark"/>
<title>S-MOVIE ORIGINAL</title><style>${BASE_STYLES}</style>
</head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;min-height:100vh;">
  <tr><td align="center" style="padding:40px 16px 60px;">
    <table width="600" cellpadding="0" cellspacing="0" border="0"
           style="max-width:600px;width:100%;background:#141414;border-radius:14px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.7);">
      ${bodyContent}
    </table>
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;margin-top:24px;">
      <tr><td align="center" style="padding:0 20px;">
        <p style="margin:0;font-size:11px;color:#404040;line-height:1.6;">
          © ${new Date().getFullYear()} S-MOVIE ORIGINAL. All rights reserved.<br/>
          You received this because you have an S-MOVIE ORIGINAL account.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function logoBar(rightBadge = ""): string {
  return /* html */`
  <tr><td style="background:linear-gradient(135deg,#0d0d0d,#1a001a);padding:28px 40px 24px;border-bottom:1.5px solid #1f1f1f;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td><span style="font-size:22px;font-weight:900;letter-spacing:5px;color:#e50914;">S-MOVIE</span>
          <span style="font-size:8px;font-weight:700;letter-spacing:4px;color:#444;display:block;margin-top:2px;">ORIGINAL</span></td>
      ${rightBadge ? `<td align="right" valign="middle">${rightBadge}</td>` : ""}
    </tr></table>
  </td></tr>`;
}

function divider(): string {
  return `<tr><td style="height:1px;background:#1f1f1f;font-size:0;line-height:0;">&nbsp;</td></tr>`;
}

function posterBlock(posterUrl: string | null, title: string | null): string {
  if (!posterUrl) return "";
  const safeTitle = title ? title.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
  return /* html */`
  <tr><td style="padding:0;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;">
      <tr><td style="padding:0;line-height:0;">
        <!-- Email-safe image with gradient overlay trick -->
        <div style="position:relative;line-height:0;">
          <img src="${posterUrl}" alt="${safeTitle}" width="600"
               style="width:100%;max-width:600px;height:300px;object-fit:cover;display:block;border:0;"/>
        </div>
      </td></tr>
      ${safeTitle ? `<tr><td style="padding:10px 40px 16px;background:#0d0d0d;">
        <p style="margin:0;font-size:12px;font-weight:700;color:#555;letter-spacing:2px;text-transform:uppercase;">Continue Watching</p>
        <h3 style="margin:4px 0 0;font-size:18px;font-weight:800;color:#fff;">${safeTitle}</h3>
      </td></tr>` : ""}
    </table>
  </td></tr>`;
}

// ---------------------------------------------------------------------------
// Template 1 — WELCOME EMAIL
// ---------------------------------------------------------------------------

function buildWelcomeHtml(recipientEmail: string, displayName?: string): string {
  const name = displayName ?? recipientEmail.split("@")[0];
  const body = /* html */`
    <tr><td style="background:linear-gradient(160deg,#1a0000 0%,#0d0d0d 40%,#001a1a 100%);padding:50px 40px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;"><tr>
        <td><span style="font-size:24px;font-weight:900;letter-spacing:6px;color:#e50914;">S-MOVIE</span>
            <span style="font-size:8px;letter-spacing:4px;color:#444;display:block;margin-top:3px;">ORIGINAL</span></td>
        <td align="right" valign="middle">
          <span style="background:#e50914;color:#fff;font-size:9px;font-weight:700;letter-spacing:2px;padding:4px 10px;border-radius:3px;text-transform:uppercase;">NEW MEMBER</span>
        </td>
      </tr></table>
      <h1 style="margin:0 0 12px;font-size:34px;font-weight:900;color:#fff;line-height:1.15;letter-spacing:-.5px;">
        Welcome<br/>to the club,<br/><span style="color:#00e5ff;">${name}.</span>
      </h1>
      <p style="margin:0;font-size:15px;color:#888;line-height:1.7;max-width:420px;">
        Your cinematic universe just got bigger. Stream thousands of movies &amp; series — any time.
      </p>
      <div style="width:48px;height:3px;background:#e50914;border-radius:2px;margin:28px 0 0;"></div>
    </td></tr>
    <tr><td style="padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a1a1a;"><tr>
        <td width="33%" align="center" style="padding:22px 8px;border-right:1px solid #222;">
          <div style="font-size:22px;margin-bottom:8px;">🎬</div>
          <div style="font-size:11px;font-weight:700;color:#fff;letter-spacing:1px;text-transform:uppercase;">4K Streaming</div>
        </td>
        <td width="33%" align="center" style="padding:22px 8px;border-right:1px solid #222;">
          <div style="font-size:22px;margin-bottom:8px;">⬇️</div>
          <div style="font-size:11px;font-weight:700;color:#fff;letter-spacing:1px;text-transform:uppercase;">Downloads</div>
        </td>
        <td width="34%" align="center" style="padding:22px 8px;">
          <div style="font-size:22px;margin-bottom:8px;">🤖</div>
          <div style="font-size:11px;font-weight:700;color:#fff;letter-spacing:1px;text-transform:uppercase;">AI Picks</div>
        </td>
      </tr></table>
    </td></tr>
    ${divider()}
    <tr><td align="center" style="padding:44px 40px;">
      <p style="margin:0 0 28px;font-size:15px;color:#888;line-height:1.7;max-width:400px;text-align:center;">
        Your account is active and ready. Dive into over 10,000 titles waiting right now.
      </p>
      <a href="${APP_URL()}" style="display:inline-block;background:linear-gradient(135deg,#e50914,#c2080f);color:#fff;font-size:15px;font-weight:700;letter-spacing:.8px;padding:16px 52px;border-radius:7px;text-transform:uppercase;">
        Start Watching →
      </a>
      <p style="margin:20px 0 0;font-size:11px;color:#404040;">Sent to <span style="color:#666;">${recipientEmail}</span></p>
    </td></tr>`;
  return emailShell(body);
}

// ---------------------------------------------------------------------------
// Template 2 — OTP EMAIL
// ---------------------------------------------------------------------------

function buildOtpHtml(recipientEmail: string, otp: string, expiryMinutes = 5): string {
  const digits = otp.split("").map((d) =>
    `<td style="padding:4px 5px;"><span style="font-size:40px;font-weight:900;color:#00e5ff;background:#111;border:2px solid #00e5ff33;border-radius:8px;width:50px;height:58px;display:inline-block;text-align:center;line-height:58px;font-family:'Courier New',monospace;">${d}</span></td>`
  ).join("");
  const body = /* html */`
    ${logoBar(`<span style="background:#00e5ff22;border:1px solid #00e5ff44;border-radius:6px;padding:5px 12px;font-size:10px;font-weight:700;color:#00e5ff;letter-spacing:2px;text-transform:uppercase;">Verification</span>`)}
    <tr><td style="padding:44px 40px 36px;text-align:center;">
      <div style="width:64px;height:64px;background:linear-gradient(135deg,#001a1a,#00e5ff22);border:1.5px solid #00e5ff44;border-radius:50%;margin:0 auto 28px;font-size:28px;line-height:64px;">🔐</div>
      <h2 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#fff;">Your Verification Code</h2>
      <p style="margin:0 0 32px;font-size:14px;color:#666;line-height:1.6;">Enter this code to verify your identity on S-MOVIE ORIGINAL.</p>
      <table cellpadding="0" cellspacing="0" border="0" align="center"
             style="margin:0 auto 28px;border:1.5px solid #00e5ff33;border-radius:12px;padding:12px 16px;background:#0d0d0d;">
        <tr>${digits}</tr>
      </table>
      <table cellpadding="0" cellspacing="0" border="0" align="center"
             style="background:#1a0a00;border:1px solid #e5091433;border-radius:8px;padding:12px 24px;margin-bottom:32px;">
        <tr><td><span style="font-size:13px;color:#e50914;font-weight:600;">⏱ This code expires in ${expiryMinutes} minute${expiryMinutes !== 1 ? "s" : ""}.</span></td></tr>
      </table>
      <p style="margin:0 auto;font-size:13px;color:#555;line-height:1.7;max-width:380px;">
        If you didn't request this code, someone may be trying to access your account.
        <span style="color:#e50914;">Do not share this code</span> with anyone.
      </p>
    </td></tr>
    ${divider()}
    <tr><td style="padding:20px 40px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#333;">Sent to <span style="color:#555;">${recipientEmail}</span></p>
    </td></tr>`;
  return emailShell(body);
}

// ---------------------------------------------------------------------------
// Template 3 — LOGIN NOTIFICATION (with optional "Continue Watching" poster)
// ---------------------------------------------------------------------------

function buildLoginNotificationHtml(params: {
  recipientEmail: string;
  deviceName: string;
  loginTime: string;
  location: string;
  posterUrl?: string | null;
  movieTitle?: string | null;
  secureAccountUrl?: string;
}): string {
  const { recipientEmail, deviceName, loginTime, location, posterUrl, movieTitle, secureAccountUrl } = params;
  const body = /* html */`
    ${logoBar(`<span style="background:#e5091422;border:1px solid #e5091455;border-radius:6px;padding:5px 12px;font-size:10px;font-weight:700;color:#e50914;letter-spacing:2px;text-transform:uppercase;">⚠ Security Alert</span>`)}
    ${posterBlock(posterUrl ?? null, movieTitle ?? null)}
    <tr><td style="padding:36px 40px 28px;">
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#fff;">New sign-in detected</h2>
      <p style="margin:0 0 28px;font-size:14px;color:#777;line-height:1.7;">
        A new login to your S-MOVIE ORIGINAL account was just detected.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:#1a1a1a;border-radius:10px;overflow:hidden;margin-bottom:28px;">
        <tr><td style="padding:14px 20px;border-bottom:1px solid #222;">
          <span style="font-size:10px;color:#555;letter-spacing:1.5px;text-transform:uppercase;display:block;margin-bottom:3px;">Device</span>
          <span style="font-size:14px;color:#e0e0e0;font-weight:600;">${deviceName}</span>
        </td></tr>
        <tr><td style="padding:14px 20px;border-bottom:1px solid #222;">
          <span style="font-size:10px;color:#555;letter-spacing:1.5px;text-transform:uppercase;display:block;margin-bottom:3px;">Time</span>
          <span style="font-size:14px;color:#e0e0e0;font-weight:600;">${loginTime}</span>
        </td></tr>
        <tr><td style="padding:14px 20px;">
          <span style="font-size:10px;color:#555;letter-spacing:1.5px;text-transform:uppercase;display:block;margin-bottom:3px;">Location</span>
          <span style="font-size:14px;color:#e0e0e0;font-weight:600;">${location}</span>
        </td></tr>
      </table>
      <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#fff;">Was this you?</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td width="48%" style="padding-right:8px;">
          <a href="${APP_URL()}" style="display:block;text-align:center;background:#1f1f1f;border:1.5px solid #333;color:#fff;font-size:13px;font-weight:600;padding:14px 8px;border-radius:7px;">✓ Yes, it was me</a>
        </td>
        <td width="52%" style="padding-left:8px;">
          <a href="${secureAccountUrl ?? APP_URL()}" style="display:block;text-align:center;background:linear-gradient(135deg,#e50914,#c2080f);color:#fff;font-size:13px;font-weight:700;padding:14px 8px;border-radius:7px;">🔒 Secure My Account</a>
        </td>
      </tr></table>
      <p style="margin:20px 0 0;font-size:12px;color:#444;line-height:1.7;text-align:center;">
        If this wasn't you, change your password and revoke access from Security settings immediately.
      </p>
    </td></tr>
    ${divider()}
    <tr><td style="padding:18px 40px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#333;">Sent to <span style="color:#555;">${recipientEmail}</span></p>
    </td></tr>`;
  return emailShell(body);
}

// ---------------------------------------------------------------------------
// Template 4 — GOODBYE / LOGOUT EMAIL
// ---------------------------------------------------------------------------

function buildGoodbyeHtml(recipientEmail: string, displayName?: string | null): string {
  const name = displayName ?? recipientEmail.split("@")[0];
  const body = /* html */`
    <tr><td style="background:linear-gradient(160deg,#0d0d0d 0%,#111 60%,#0a0a1a 100%);padding:50px 40px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;"><tr>
        <td><span style="font-size:24px;font-weight:900;letter-spacing:6px;color:#e50914;">S-MOVIE</span>
            <span style="font-size:8px;letter-spacing:4px;color:#444;display:block;margin-top:3px;">ORIGINAL</span></td>
      </tr></table>
      <div style="font-size:48px;margin-bottom:24px;text-align:left;">👋</div>
      <h1 style="margin:0 0 12px;font-size:30px;font-weight:900;color:#fff;line-height:1.2;letter-spacing:-.5px;">
        See you soon,<br/><span style="color:#00e5ff;">${name}.</span>
      </h1>
      <p style="margin:0;font-size:15px;color:#888;line-height:1.7;max-width:420px;">
        You've successfully signed out of S-MOVIE ORIGINAL. Your watchlist and progress are safely saved.
      </p>
      <div style="width:48px;height:3px;background:#e50914;border-radius:2px;margin:28px 0 0;"></div>
    </td></tr>
    ${divider()}
    <tr><td style="padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a1a1a;"><tr>
        <td width="33%" align="center" style="padding:20px 8px;border-right:1px solid #222;">
          <div style="font-size:20px;margin-bottom:6px;">📌</div>
          <div style="font-size:11px;font-weight:700;color:#fff;letter-spacing:1px;text-transform:uppercase;">Watchlist Saved</div>
        </td>
        <td width="33%" align="center" style="padding:20px 8px;border-right:1px solid #222;">
          <div style="font-size:20px;margin-bottom:6px;">⏯️</div>
          <div style="font-size:11px;font-weight:700;color:#fff;letter-spacing:1px;text-transform:uppercase;">Progress Kept</div>
        </td>
        <td width="34%" align="center" style="padding:20px 8px;">
          <div style="font-size:20px;margin-bottom:6px;">🔔</div>
          <div style="font-size:11px;font-weight:700;color:#fff;letter-spacing:1px;text-transform:uppercase;">New Releases Wait</div>
        </td>
      </tr></table>
    </td></tr>
    ${divider()}
    <tr><td align="center" style="padding:40px 40px;">
      <p style="margin:0 0 24px;font-size:15px;color:#888;line-height:1.7;max-width:380px;text-align:center;">
        The movies aren't going anywhere. Come back whenever you're ready.
      </p>
      <a href="${APP_URL()}" style="display:inline-block;background:linear-gradient(135deg,#e50914,#c2080f);color:#fff;font-size:14px;font-weight:700;letter-spacing:.8px;padding:14px 44px;border-radius:7px;text-transform:uppercase;">
        Sign Back In →
      </a>
      <p style="margin:20px 0 0;font-size:11px;color:#404040;">Signed out: <span style="color:#666;">${recipientEmail}</span></p>
    </td></tr>`;
  return emailShell(body);
}

// ---------------------------------------------------------------------------
// Template 5 — DAILY FEATURED / CONTINUE WATCHING EMAIL (cron)
// ---------------------------------------------------------------------------

function buildDailyFeaturedHtml(params: {
  recipientEmail: string;
  displayName?: string | null;
  posterUrl: string;
  movieTitle: string;
  isContinueWatching: boolean;
  rating?: string | null;
  releaseDate?: string | null;
  overview?: string | null;
  isNewRelease?: boolean;
}): string {
  const { recipientEmail, displayName, posterUrl, movieTitle,
          isContinueWatching, rating, releaseDate, overview, isNewRelease } = params;
  const name     = displayName ?? recipientEmail.split("@")[0];
  const heading  = isContinueWatching ? "Continue where you left off" : "Today's Featured Pick";
  const ctaLabel = isContinueWatching ? "Resume Watching →" : "Watch Now →";

  // Format release year
  const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : null;

  // New-release badge (only for non-continue-watching items)
  const newReleaseBadge = (!isContinueWatching && isNewRelease)
    ? `<span style="display:inline-block;background:#00e5ff22;border:1px solid #00e5ff55;border-radius:4px;padding:3px 10px;font-size:10px;font-weight:700;color:#00e5ff;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">🆕 NEW RELEASE</span><br/>`
    : "";

  // Rating row
  const ratingRow = rating
    ? `<p style="margin:6px 0 16px;font-size:14px;color:#f5c518;font-family:'Courier New',monospace;letter-spacing:1px;">${rating}</p>`
    : "";

  // Overview
  const overviewRow = overview
    ? `<p style="margin:0 0 28px;font-size:13px;color:#777;line-height:1.65;max-width:480px;">${overview.slice(0, 200)}${overview.length > 200 ? "…" : ""}</p>`
    : `<p style="margin:0 0 28px;font-size:14px;color:#888;line-height:1.7;">${isContinueWatching ? `You were watching <strong style="color:#fff;">${movieTitle}</strong>. Pick it back up right where you paused.` : `Our editors have picked <strong style="color:#fff;">${movieTitle}</strong> for you today. Don't miss it.`}</p>`;

  const body = /* html */`
    ${logoBar()}
    <tr><td style="padding:0;line-height:0;">
      <img src="${posterUrl}" alt="${movieTitle.replace(/</g,"&lt;")}" width="600"
           style="width:100%;max-width:600px;height:320px;object-fit:cover;display:block;border:0;"/>
    </td></tr>
    <tr><td style="padding:36px 40px 32px;">
      ${newReleaseBadge}
      <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#e50914;letter-spacing:3px;text-transform:uppercase;">
        ${isContinueWatching ? "Continue Watching" : "Featured Today"}
      </p>
      <h2 style="margin:0 0 6px;font-size:26px;font-weight:900;color:#fff;line-height:1.2;">${heading}</h2>
      <h3 style="margin:0 0 2px;font-size:18px;font-weight:700;color:#00e5ff;">
        ${movieTitle}${releaseYear ? ` <span style="font-size:14px;color:#555;font-weight:400;">(${releaseYear})</span>` : ""}
      </h3>
      ${ratingRow}
      ${overviewRow}
      <a href="${APP_URL()}" style="display:inline-block;background:linear-gradient(135deg,#e50914,#c2080f);color:#fff;font-size:14px;font-weight:700;letter-spacing:.8px;padding:15px 44px;border-radius:7px;text-transform:uppercase;">${ctaLabel}</a>
    </td></tr>
    ${divider()}
    <tr><td style="padding:20px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="font-size:12px;color:#555;">Hi, <span style="color:#777;">${name}</span> — your daily S-MOVIE update.</td>
        <td align="right" style="font-size:11px;color:#333;">${recipientEmail}</td>
      </tr></table>
    </td></tr>`;
  return emailShell(body);
}

// ---------------------------------------------------------------------------
// Shared send helper (with deliverability headers)
// ---------------------------------------------------------------------------

async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const transporter = createTransporter();
  await transporter.sendMail({
    from:    `"${SENDER_NAME}" <${SENDER_EMAIL()}>`,
    to:      opts.to,
    subject: opts.subject,
    html:    opts.html,
    text:    opts.text,
    headers: {
      "X-Priority":      "3",
      "X-Mailer":        "S-MOVIE Notification Service",
      "X-Entity-Ref-ID": `smovie-${Date.now()}`,
      "Precedence":      "bulk",
      "Auto-Submitted":  "auto-generated",
    },
  });
}

// ---------------------------------------------------------------------------
// Public send functions — all swallow errors so callers are never blocked
// ---------------------------------------------------------------------------

export async function sendWelcomeEmail(recipientEmail: string, displayName?: string): Promise<void> {
  try {
    await sendMail({
      to:      recipientEmail,
      subject: "🎬 Welcome to S-MOVIE ORIGINAL — Your cinematic home awaits",
      html:    buildWelcomeHtml(recipientEmail, displayName),
      text:    `Welcome to S-MOVIE ORIGINAL, ${displayName ?? recipientEmail}!\n\nStart watching: ${APP_URL()}`,
    });
    logger.info({ recipientEmail }, "Welcome email sent");
  } catch (err) {
    logger.error({ err, recipientEmail }, "Welcome email failed (non-fatal)");
  }
}

export async function sendOtpEmail(recipientEmail: string, otp: string, expiryMinutes = 5): Promise<void> {
  try {
    await sendMail({
      to:      recipientEmail,
      subject: `${otp} is your S-MOVIE ORIGINAL verification code`,
      html:    buildOtpHtml(recipientEmail, otp, expiryMinutes),
      text:    `Your S-MOVIE ORIGINAL code: ${otp}\nExpires in ${expiryMinutes} minutes. Do not share.`,
    });
    logger.info({ recipientEmail }, "OTP email sent");
  } catch (err) {
    logger.error({ err, recipientEmail }, "OTP email failed (non-fatal)");
  }
}

export async function sendLoginNotificationEmail(params: {
  recipientEmail: string;
  deviceName: string;
  loginTime: string;
  location: string;
  posterUrl?: string | null;
  movieTitle?: string | null;
  secureAccountUrl?: string;
}): Promise<void> {
  try {
    await sendMail({
      to:      params.recipientEmail,
      subject: "⚠ New sign-in to your S-MOVIE ORIGINAL account",
      html:    buildLoginNotificationHtml(params),
      text:    `New sign-in detected.\nDevice: ${params.deviceName}\nTime: ${params.loginTime}\nLocation: ${params.location}\nNot you? Secure your account: ${APP_URL()}`,
    });
    logger.info({ recipientEmail: params.recipientEmail }, "Login notification sent");
  } catch (err) {
    logger.error({ err, recipientEmail: params.recipientEmail }, "Login notification failed (non-fatal)");
  }
}

export async function sendGoodbyeEmail(recipientEmail: string, displayName?: string | null): Promise<void> {
  try {
    await sendMail({
      to:      recipientEmail,
      subject: "👋 See you soon — You've signed out of S-MOVIE ORIGINAL",
      html:    buildGoodbyeHtml(recipientEmail, displayName),
      text:    `You've been signed out of S-MOVIE ORIGINAL.\n\nSign back in any time: ${APP_URL()}`,
    });
    logger.info({ recipientEmail }, "Goodbye email sent");
  } catch (err) {
    logger.error({ err, recipientEmail }, "Goodbye email failed (non-fatal)");
  }
}

export async function sendDailyFeaturedEmail(params: {
  recipientEmail: string;
  displayName?: string | null;
  posterUrl: string;
  movieTitle: string;
  isContinueWatching: boolean;
  rating?: string | null;
  releaseDate?: string | null;
  overview?: string | null;
  isNewRelease?: boolean;
}): Promise<void> {
  try {
    const subject = params.isContinueWatching
      ? `▶ Resume "${params.movieTitle}" on S-MOVIE ORIGINAL`
      : `🎬 Today's Pick: "${params.movieTitle}" — S-MOVIE ORIGINAL`;
    await sendMail({
      to:      params.recipientEmail,
      subject,
      html:    buildDailyFeaturedHtml(params),
      text:    `${params.isContinueWatching ? "Continue watching" : "Featured today"}: ${params.movieTitle}\n\nOpen S-MOVIE: ${APP_URL()}`,
    });
    logger.info({ recipientEmail: params.recipientEmail, movieTitle: params.movieTitle }, "Daily featured email sent");
  } catch (err) {
    logger.error({ err, recipientEmail: params.recipientEmail }, "Daily featured email failed (non-fatal)");
  }
}
