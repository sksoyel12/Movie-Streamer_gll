import nodemailer from "nodemailer";
import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Transporter
// ---------------------------------------------------------------------------

function createTransporter() {
  const user = process.env["EMAIL_USER"] ?? process.env["Email_user"] ?? process.env["email_user"];
  const pass = process.env["EMAIL_PASS"] ?? process.env["Email_pass"] ?? process.env["email_pass"];
  if (!user || !pass)
    throw new Error("EMAIL_USER and EMAIL_PASS must be set to send emails.");
  return nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
}

const SENDER_NAME  = "S-MOVIE ORIGINAL";
const APP_URL      = () => process.env["APP_URL"] ?? "https://s-movie.replit.app";
const SENDER_EMAIL = () => process.env["EMAIL_USER"] ?? "";

// ---------------------------------------------------------------------------
// Shared layout shell — responsive, dark, email-safe
// ---------------------------------------------------------------------------

const BASE_STYLES = `
  body{margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;}
  table{border-collapse:collapse;}
  a{text-decoration:none;}
  img{display:block;border:0;}
  @media only screen and (max-width:600px){
    .outer-td{padding:0 !important;}
    .card{border-radius:0 !important;}
    .hero-img{height:220px !important;}
    .content-pad{padding:28px 20px !important;}
    .btn-full{display:block !important;width:100% !important;box-sizing:border-box !important;text-align:center !important;}
    .hide-mobile{display:none !important;}
    .footer-pad{padding:16px 20px !important;}
  }
`;

function emailShell(bodyContent: string): string {
  return /* html */`<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta name="color-scheme" content="dark"/>
<meta name="supported-color-schemes" content="dark"/>
<title>S-MOVIE ORIGINAL</title>
<style>${BASE_STYLES}</style>
</head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;min-height:100vh;">
  <tr><td class="outer-td" align="center" style="padding:32px 16px 48px;">
    <table class="card" width="600" cellpadding="0" cellspacing="0" border="0"
           style="max-width:600px;width:100%;background:#141414;border-radius:16px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.8);">
      ${bodyContent}
    </table>
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;margin-top:20px;">
      <tr><td class="footer-pad" align="center" style="padding:0 20px;">
        <p style="margin:0;font-size:11px;color:#3a3a3a;line-height:1.6;">
          © ${new Date().getFullYear()} S-MOVIE ORIGINAL. All rights reserved.<br/>
          You received this because you have an S-MOVIE ORIGINAL account.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Shared blocks
// ---------------------------------------------------------------------------

function heroBlock(posterUrl: string | null, overlayGradient = "linear-gradient(to bottom, rgba(0,0,0,.1) 0%, rgba(20,20,20,.95) 100%)"): string {
  if (!posterUrl) return "";
  return /* html */`
  <tr><td style="padding:0;line-height:0;position:relative;">
    <div style="position:relative;line-height:0;overflow:hidden;">
      <img class="hero-img" src="${posterUrl}" alt="Featured movie" width="600"
           style="width:100%;max-width:600px;height:340px;object-fit:cover;display:block;border:0;"/>
      <div style="position:absolute;bottom:0;left:0;right:0;height:180px;background:${overlayGradient};line-height:0;"></div>
    </div>
  </td></tr>`;
}

function logoBar(badge = ""): string {
  return /* html */`
  <tr><td style="background:#0d0d0d;padding:22px 32px;border-bottom:1px solid #1e1e1e;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td valign="middle">
        <span style="font-size:20px;font-weight:900;letter-spacing:5px;color:#e50914;">S-MOVIE</span>
        <span style="font-size:7px;font-weight:700;letter-spacing:4px;color:#3a3a3a;display:block;margin-top:1px;">ORIGINAL</span>
      </td>
      ${badge ? `<td align="right" valign="middle">${badge}</td>` : ""}
    </tr></table>
  </td></tr>`;
}

function divider(): string {
  return `<tr><td style="height:1px;background:#1e1e1e;font-size:0;line-height:0;">&nbsp;</td></tr>`;
}

function fullWidthButton(label: string, url: string, bgColor = "#e50914"): string {
  return /* html */`
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td style="padding:0;">
      <a class="btn-full" href="${url}"
         style="display:block;background:${bgColor};color:#fff;font-size:15px;font-weight:800;letter-spacing:1.5px;padding:18px 24px;border-radius:8px;text-transform:uppercase;text-align:center;line-height:1;">
        ${label}
      </a>
    </td></tr>
  </table>`;
}

// ---------------------------------------------------------------------------
// Template 1 — WELCOME EMAIL  (hero poster + no static icons)
// ---------------------------------------------------------------------------

function buildWelcomeHtml(
  recipientEmail: string,
  displayName?: string,
  posterUrl?: string | null,
  movieTitle?: string | null,
): string {
  const name = displayName ?? recipientEmail.split("@")[0];

  const posterSection = posterUrl
    ? heroBlock(posterUrl, "linear-gradient(to bottom, rgba(0,0,0,.05) 0%, rgba(20,20,20,1) 100%)")
    : "";

  const body = /* html */`
    ${posterSection}
    <tr><td class="content-pad" style="padding:44px 40px 20px;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#e50914;letter-spacing:3px;text-transform:uppercase;">New Member</p>
      <h1 style="margin:0 0 16px;font-size:32px;font-weight:900;color:#ffffff;line-height:1.15;letter-spacing:-.5px;">
        Welcome to the<br/><span style="color:#e50914;">S-MOVIE family.</span>
      </h1>
      <p style="margin:0 0 32px;font-size:15px;color:#888;line-height:1.75;max-width:460px;">
        Your cinematic journey begins now. Access thousands of blockbusters, anytime, anywhere.
      </p>
      <p style="margin:0 0 28px;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:.5px;">
        Get ready to binge. 🍿
      </p>
      ${fullWidthButton("WATCH NOW →", APP_URL())}
      <p style="margin:20px 0 0;font-size:11px;color:#3a3a3a;text-align:center;">
        Sent to <span style="color:#555;">${recipientEmail}</span>
      </p>
    </td></tr>
    ${movieTitle ? `
    ${divider()}
    <tr><td style="padding:16px 40px;background:#0d0d0d;">
      <p style="margin:0;font-size:11px;color:#555;text-align:center;">
        ▶ Trending now: <strong style="color:#888;">${movieTitle}</strong>
      </p>
    </td></tr>` : ""}`;

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
    <tr><td class="content-pad" style="padding:44px 40px 36px;text-align:center;">
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
// Template 3 — LOGIN NOTIFICATION  (dynamic poster hero)
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
    ${posterUrl
      ? heroBlock(posterUrl, "linear-gradient(to bottom, rgba(0,0,0,.3) 0%, rgba(20,20,20,1) 100%)")
      : logoBar(`<span style="background:#e5091422;border:1px solid #e5091455;border-radius:6px;padding:5px 12px;font-size:10px;font-weight:700;color:#e50914;letter-spacing:2px;text-transform:uppercase;">⚠ Security Alert</span>`)}
    ${posterUrl ? `
    <tr><td style="padding:8px 32px 0;background:#141414;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="middle">
          <span style="font-size:20px;font-weight:900;letter-spacing:5px;color:#e50914;">S-MOVIE</span>
          <span style="font-size:7px;font-weight:700;letter-spacing:4px;color:#3a3a3a;display:block;margin-top:1px;">ORIGINAL</span>
        </td>
        <td align="right" valign="middle">
          <span style="background:#e5091422;border:1px solid #e5091455;border-radius:6px;padding:5px 12px;font-size:10px;font-weight:700;color:#e50914;letter-spacing:2px;text-transform:uppercase;">⚠ Security Alert</span>
        </td>
      </tr></table>
    </td></tr>` : ""}
    <tr><td class="content-pad" style="padding:32px 40px 28px;">
      ${movieTitle ? `<p style="margin:0 0 4px;font-size:11px;color:#555;letter-spacing:1px;text-transform:uppercase;">Last watched: <strong style="color:#777;">${movieTitle}</strong></p>` : ""}
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#fff;">New sign-in detected</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.7;">
        A new login to your S-MOVIE ORIGINAL account was just detected.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:#1a1a1a;border-radius:10px;overflow:hidden;margin-bottom:28px;border:1px solid #222;">
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
      <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#fff;">Was this you?</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td width="48%" style="padding-right:8px;">
          <a href="${APP_URL()}"
             style="display:block;text-align:center;background:#1f1f1f;border:1.5px solid #333;color:#fff;font-size:13px;font-weight:600;padding:14px 8px;border-radius:8px;">
            ✓ Yes, it was me
          </a>
        </td>
        <td width="52%" style="padding-left:8px;">
          <a href="${secureAccountUrl ?? APP_URL()}"
             style="display:block;text-align:center;background:#e50914;color:#fff;font-size:13px;font-weight:700;padding:14px 8px;border-radius:8px;">
            🔒 Secure My Account
          </a>
        </td>
      </tr></table>
      <p style="margin:20px 0 0;font-size:12px;color:#444;line-height:1.7;text-align:center;">
        If this wasn't you, change your password immediately.
      </p>
    </td></tr>
    ${divider()}
    <tr><td style="padding:18px 40px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#333;">Sent to <span style="color:#555;">${recipientEmail}</span></p>
    </td></tr>`;

  return emailShell(body);
}

// ---------------------------------------------------------------------------
// Template 4 — GOODBYE / LOGOUT EMAIL  (dynamic poster hero)
// ---------------------------------------------------------------------------

function buildGoodbyeHtml(
  recipientEmail: string,
  displayName?: string | null,
  posterUrl?: string | null,
  movieTitle?: string | null,
): string {
  const name = displayName ?? recipientEmail.split("@")[0];

  const body = /* html */`
    ${posterUrl
      ? heroBlock(posterUrl, "linear-gradient(to bottom, rgba(0,0,0,.15) 0%, rgba(20,20,20,1) 100%)")
      : ""}
    ${posterUrl ? `
    <tr><td style="padding:20px 32px 0;">
      <span style="font-size:20px;font-weight:900;letter-spacing:5px;color:#e50914;">S-MOVIE</span>
      <span style="font-size:7px;font-weight:700;letter-spacing:4px;color:#3a3a3a;display:block;margin-top:1px;">ORIGINAL</span>
    </td></tr>` : logoBar()}
    <tr><td class="content-pad" style="padding:36px 40px 40px;">
      <div style="font-size:44px;margin-bottom:20px;">👋</div>
      <h1 style="margin:0 0 12px;font-size:28px;font-weight:900;color:#fff;line-height:1.2;">
        See you soon,<br/><span style="color:#00e5ff;">${name}.</span>
      </h1>
      <p style="margin:0 0 28px;font-size:15px;color:#777;line-height:1.75;max-width:420px;">
        You've successfully signed out of S-MOVIE ORIGINAL. Your watchlist and progress are safely saved — we'll be here when you're ready.
      </p>
      ${movieTitle ? `<p style="margin:0 0 24px;font-size:13px;color:#555;">Pick up where you left off: <strong style="color:#888;">${movieTitle}</strong></p>` : ""}
      ${fullWidthButton("WATCH NOW →", APP_URL())}
      <p style="margin:20px 0 0;font-size:11px;color:#3a3a3a;text-align:center;">
        Signed out: <span style="color:#555;">${recipientEmail}</span>
      </p>
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
  const ctaLabel = isContinueWatching ? "RESUME WATCHING →" : "WATCH NOW →";

  const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : null;

  const newReleaseBadge = (!isContinueWatching && isNewRelease)
    ? `<span style="display:inline-block;background:#00e5ff22;border:1px solid #00e5ff55;border-radius:4px;padding:3px 10px;font-size:10px;font-weight:700;color:#00e5ff;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">🆕 NEW RELEASE</span><br/>`
    : "";

  const ratingRow = rating
    ? `<p style="margin:6px 0 16px;font-size:14px;color:#f5c518;font-family:'Courier New',monospace;letter-spacing:1px;">${rating}</p>`
    : "";

  const overviewRow = overview
    ? `<p style="margin:0 0 28px;font-size:13px;color:#777;line-height:1.65;max-width:480px;">${overview.slice(0, 200)}${overview.length > 200 ? "…" : ""}</p>`
    : `<p style="margin:0 0 28px;font-size:14px;color:#888;line-height:1.7;">${isContinueWatching ? `You were watching <strong style="color:#fff;">${movieTitle}</strong>. Pick it back up right where you paused.` : `Our editors have picked <strong style="color:#fff;">${movieTitle}</strong> for you today. Don't miss it.`}</p>`;

  const body = /* html */`
    ${logoBar()}
    <tr><td style="padding:0;line-height:0;">
      <img src="${posterUrl}" alt="${movieTitle.replace(/</g,"&lt;")}" width="600"
           style="width:100%;max-width:600px;height:320px;object-fit:cover;display:block;border:0;"/>
    </td></tr>
    <tr><td class="content-pad" style="padding:36px 40px 32px;">
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
      ${fullWidthButton(ctaLabel, APP_URL())}
    </td></tr>
    ${divider()}
    <tr><td class="footer-pad" style="padding:20px 40px;">
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

export async function sendWelcomeEmail(
  recipientEmail: string,
  displayName?: string,
  posterUrl?: string | null,
  movieTitle?: string | null,
): Promise<void> {
  try {
    await sendMail({
      to:      recipientEmail,
      subject: "🎬 Welcome to the S-MOVIE family — Your cinematic journey begins now",
      html:    buildWelcomeHtml(recipientEmail, displayName, posterUrl, movieTitle),
      text:    `Welcome to S-MOVIE ORIGINAL, ${displayName ?? recipientEmail}!\n\nYour cinematic journey begins now. Access thousands of blockbusters, anytime, anywhere.\n\nGet ready to binge → ${APP_URL()}`,
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

export async function sendGoodbyeEmail(
  recipientEmail: string,
  displayName?: string | null,
  posterUrl?: string | null,
  movieTitle?: string | null,
): Promise<void> {
  try {
    await sendMail({
      to:      recipientEmail,
      subject: "👋 See you soon — You've signed out of S-MOVIE ORIGINAL",
      html:    buildGoodbyeHtml(recipientEmail, displayName, posterUrl, movieTitle),
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
