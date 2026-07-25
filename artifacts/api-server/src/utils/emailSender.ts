import nodemailer from "nodemailer";
import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Transporter (singleton-per-call — nodemailer handles pooling internally)
// ---------------------------------------------------------------------------

function createTransporter() {
  const user = process.env["EMAIL_USER"];
  const pass = process.env["EMAIL_PASS"];
  if (!user || !pass) {
    throw new Error("EMAIL_USER and EMAIL_PASS must be set to send emails.");
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
    // These headers help Gmail route to Primary inbox rather than Promotions
    pool: false,
  });
}

const SENDER_NAME  = "S-MOVIE ORIGINAL";
const APP_URL      = () => process.env["APP_URL"] ?? "https://s-movie.replit.app";
const SENDER_EMAIL = () => process.env["EMAIL_USER"] ?? "";

// ---------------------------------------------------------------------------
// Shared layout primitives (inline-CSS only — email client safe)
// ---------------------------------------------------------------------------

const BASE_STYLES = /* css */ `
  body  { margin:0; padding:0; background:#0a0a0a; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; }
  table { border-collapse:collapse; }
  a     { text-decoration:none; }
  img   { display:block; border:0; }
`;

function emailShell(bodyContent: string): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="color-scheme" content="dark"/>
  <meta name="supported-color-schemes" content="dark"/>
  <title>S-MOVIE ORIGINAL</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;min-height:100vh;">
  <tr>
    <td align="center" style="padding:40px 16px 60px;">

      <!-- Card -->
      <table width="600" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;width:100%;background:#141414;border-radius:14px;
                    overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.7);">
        ${bodyContent}
      </table>
      <!-- /Card -->

      <!-- Footer note -->
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;margin-top:24px;">
        <tr>
          <td align="center" style="padding:0 20px;">
            <p style="margin:0;font-size:11px;color:#404040;line-height:1.6;letter-spacing:.3px;">
              © ${new Date().getFullYear()} S-MOVIE ORIGINAL. All rights reserved.<br/>
              This email was sent because you have an account with S-MOVIE ORIGINAL.
            </p>
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}

function logo(): string {
  return /* html */ `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" style="padding:28px 40px 24px;">
          <span style="font-size:22px;font-weight:900;letter-spacing:5px;color:#e50914;text-transform:uppercase;">S-MOVIE</span>
          <span style="font-size:8px;font-weight:700;letter-spacing:4px;color:#555;text-transform:uppercase;display:block;margin-top:2px;">ORIGINAL</span>
        </td>
      </tr>
    </table>`;
}

function divider(color = "#1f1f1f"): string {
  return `<tr><td style="height:1px;background:${color};font-size:0;line-height:0;">&nbsp;</td></tr>`;
}

// ---------------------------------------------------------------------------
// Template 1 — WELCOME EMAIL
// ---------------------------------------------------------------------------

function buildWelcomeHtml(recipientEmail: string, displayName?: string): string {
  const name = displayName ?? recipientEmail.split("@")[0];

  const body = /* html */ `

    <!-- Hero poster (cinematic gradient, email-safe) -->
    <tr>
      <td style="padding:0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:linear-gradient(160deg,#1a0000 0%,#0d0d0d 40%,#001a1a 100%);
                        padding:50px 40px 40px;position:relative;">

              <!-- Decorative film-grain overlay (pure CSS, no image needed) -->
              <div style="position:absolute;top:0;left:0;right:0;bottom:0;
                          background:repeating-linear-gradient(
                            0deg,transparent,transparent 2px,
                            rgba(0,0,0,.08) 2px,rgba(0,0,0,.08) 4px);
                          pointer-events:none;"></div>

              <!-- Wordmark -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                <tr>
                  <td>
                    <span style="font-size:24px;font-weight:900;letter-spacing:6px;color:#e50914;">S-MOVIE</span>
                    <span style="font-size:8px;letter-spacing:4px;color:#444;display:block;margin-top:3px;">ORIGINAL</span>
                  </td>
                  <td align="right" valign="middle">
                    <span style="background:#e50914;color:#fff;font-size:9px;font-weight:700;
                                 letter-spacing:2px;padding:4px 10px;border-radius:3px;text-transform:uppercase;">
                      NEW MEMBER
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Hero text -->
              <h1 style="margin:0 0 12px;font-size:34px;font-weight:900;color:#ffffff;
                          line-height:1.15;letter-spacing:-.5px;">
                Welcome<br/>to the club,<br/>
                <span style="color:#00e5ff;">${name}.</span>
              </h1>
              <p style="margin:0;font-size:15px;color:#888;line-height:1.7;max-width:420px;">
                Your cinematic universe just got bigger. Stream thousands of
                movies &amp; series — all in one place, any time.
              </p>

              <!-- Decorative line -->
              <div style="width:48px;height:3px;background:#e50914;border-radius:2px;margin:28px 0 0;"></div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Feature strip -->
    <tr>
      <td style="padding:0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a1a1a;">
          <tr>
            <td width="33%" align="center" style="padding:22px 8px;border-right:1px solid #222;">
              <div style="font-size:22px;line-height:1;margin-bottom:8px;">🎬</div>
              <div style="font-size:11px;font-weight:700;color:#fff;letter-spacing:1px;text-transform:uppercase;">4K Streaming</div>
              <div style="font-size:10px;color:#555;margin-top:3px;">Cinema quality</div>
            </td>
            <td width="33%" align="center" style="padding:22px 8px;border-right:1px solid #222;">
              <div style="font-size:22px;line-height:1;margin-bottom:8px;">⬇️</div>
              <div style="font-size:11px;font-weight:700;color:#fff;letter-spacing:1px;text-transform:uppercase;">Downloads</div>
              <div style="font-size:10px;color:#555;margin-top:3px;">Watch offline</div>
            </td>
            <td width="34%" align="center" style="padding:22px 8px;">
              <div style="font-size:22px;line-height:1;margin-bottom:8px;">🤖</div>
              <div style="font-size:11px;font-weight:700;color:#fff;letter-spacing:1px;text-transform:uppercase;">AI Picks</div>
              <div style="font-size:10px;color:#555;margin-top:3px;">Smart recs</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${divider()}

    <!-- CTA -->
    <tr>
      <td align="center" style="padding:44px 40px;">
        <p style="margin:0 0 28px;font-size:15px;color:#888;line-height:1.7;max-width:400px;text-align:center;">
          Your account is active and ready. Dive straight into the collection —
          over 10,000 titles waiting for you right now.
        </p>
        <a href="${APP_URL()}"
           style="display:inline-block;background:linear-gradient(135deg,#e50914,#c2080f);
                  color:#fff;font-size:15px;font-weight:700;letter-spacing:.8px;
                  padding:16px 52px;border-radius:7px;text-transform:uppercase;">
          Start Watching →
        </a>
        <p style="margin:20px 0 0;font-size:11px;color:#404040;">
          Sent to <span style="color:#666;">${recipientEmail}</span>
        </p>
      </td>
    </tr>`;

  return emailShell(body);
}

// ---------------------------------------------------------------------------
// Template 2 — OTP / VERIFICATION EMAIL
// ---------------------------------------------------------------------------

function buildOtpHtml(recipientEmail: string, otp: string, expiryMinutes = 5): string {
  // Split OTP into individual digit cells for the big number display
  const digits = otp.split("").map((d) =>
    `<td style="padding:4px 6px;">
       <span style="font-size:42px;font-weight:900;color:#00e5ff;
                    background:#111;border:2px solid #00e5ff33;border-radius:8px;
                    width:52px;height:60px;display:inline-block;text-align:center;
                    line-height:60px;letter-spacing:0;font-family:'Courier New',monospace;">
         ${d}
       </span>
     </td>`).join("");

  const body = /* html */ `

    <!-- Header bar -->
    <tr>
      <td style="background:linear-gradient(135deg,#0d0d0d,#1a001a);padding:32px 40px 28px;
                  border-bottom:2px solid #00e5ff22;">
        ${logo()}
        <p style="margin:4px 0 0;font-size:12px;letter-spacing:3px;color:#555;text-transform:uppercase;">
          Security Verification
        </p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding:44px 40px 36px;text-align:center;">

        <!-- Icon -->
        <div style="width:64px;height:64px;background:linear-gradient(135deg,#001a1a,#00e5ff22);
                    border:1.5px solid #00e5ff44;border-radius:50%;margin:0 auto 28px;
                    font-size:28px;line-height:64px;">
          🔐
        </div>

        <h2 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#fff;letter-spacing:-.3px;">
          Your Verification Code
        </h2>
        <p style="margin:0 0 32px;font-size:14px;color:#666;line-height:1.6;">
          Enter this code to verify your identity on S-MOVIE ORIGINAL.
        </p>

        <!-- OTP digits -->
        <table cellpadding="0" cellspacing="0" border="0" align="center"
               style="margin:0 auto 28px;border:1.5px solid #00e5ff33;border-radius:12px;
                      padding:12px 16px;background:#0d0d0d;">
          <tr>${digits}</tr>
        </table>

        <!-- Timer warning -->
        <table cellpadding="0" cellspacing="0" border="0" align="center"
               style="background:#1a0a00;border:1px solid #e5091433;border-radius:8px;
                      padding:12px 24px;margin-bottom:32px;">
          <tr>
            <td>
              <span style="font-size:13px;color:#e50914;font-weight:600;">
                ⏱ This code expires in ${expiryMinutes} minute${expiryMinutes !== 1 ? "s" : ""}.
              </span>
            </td>
          </tr>
        </table>

        <p style="margin:0;font-size:13px;color:#555;line-height:1.7;max-width:380px;margin:0 auto;">
          If you didn't request this code, someone may be trying to access your account.
          <span style="color:#e50914;">Do not share this code</span> with anyone — S-MOVIE
          will never ask for your verification code.
        </p>
      </td>
    </tr>

    ${divider()}

    <!-- Footer inside card -->
    <tr>
      <td style="padding:20px 40px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#333;line-height:1.6;">
          Sent to <span style="color:#555;">${recipientEmail}</span>
        </p>
      </td>
    </tr>`;

  return emailShell(body);
}

// ---------------------------------------------------------------------------
// Template 3 — LOGIN NOTIFICATION EMAIL
// ---------------------------------------------------------------------------

function buildLoginNotificationHtml(params: {
  recipientEmail: string;
  deviceName: string;
  loginTime: string;
  location: string;
  secureAccountUrl?: string;
}): string {
  const { recipientEmail, deviceName, loginTime, location, secureAccountUrl } = params;
  const safeUrl = secureAccountUrl ?? APP_URL();

  const body = /* html */ `

    <!-- Alert header -->
    <tr>
      <td style="background:linear-gradient(135deg,#1a0000,#0d0d0d);
                  padding:32px 40px 28px;border-bottom:2px solid #e5091433;">
        ${logo()}
        <table cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
          <tr>
            <td style="background:#e5091422;border:1px solid #e5091455;border-radius:6px;
                        padding:6px 14px;">
              <span style="font-size:11px;font-weight:700;color:#e50914;letter-spacing:2px;text-transform:uppercase;">
                ⚠ Security Alert
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding:40px 40px 32px;">

        <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#fff;letter-spacing:-.3px;">
          New sign-in to your account
        </h2>
        <p style="margin:0 0 32px;font-size:14px;color:#777;line-height:1.7;">
          We detected a new login to your S-MOVIE ORIGINAL account. Here are the details:
        </p>

        <!-- Details table -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:#1a1a1a;border-radius:10px;overflow:hidden;margin-bottom:32px;">
          <tr>
            <td style="padding:16px 20px;border-bottom:1px solid #222;">
              <span style="font-size:11px;color:#555;letter-spacing:1.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Device</span>
              <span style="font-size:14px;color:#e0e0e0;font-weight:600;">${deviceName}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 20px;border-bottom:1px solid #222;">
              <span style="font-size:11px;color:#555;letter-spacing:1.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Time</span>
              <span style="font-size:14px;color:#e0e0e0;font-weight:600;">${loginTime}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 20px;">
              <span style="font-size:11px;color:#555;letter-spacing:1.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Location</span>
              <span style="font-size:14px;color:#e0e0e0;font-weight:600;">${location}</span>
            </td>
          </tr>
        </table>

        <!-- Was this you? -->
        <p style="margin:0 0 20px;font-size:16px;font-weight:700;color:#fff;">
          Was this you?
        </p>

        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="48%" style="padding-right:8px;">
              <a href="${APP_URL()}"
                 style="display:block;text-align:center;background:#1f1f1f;border:1.5px solid #333;
                         color:#fff;font-size:13px;font-weight:600;padding:14px 8px;
                         border-radius:7px;letter-spacing:.3px;">
                ✓ Yes, it was me
              </a>
            </td>
            <td width="52%" style="padding-left:8px;">
              <a href="${safeUrl}"
                 style="display:block;text-align:center;background:linear-gradient(135deg,#e50914,#c2080f);
                         color:#fff;font-size:13px;font-weight:700;padding:14px 8px;
                         border-radius:7px;letter-spacing:.3px;">
                🔒 Secure My Account
              </a>
            </td>
          </tr>
        </table>

        <p style="margin:24px 0 0;font-size:12px;color:#444;line-height:1.7;text-align:center;">
          If you didn't sign in, act immediately — change your password and
          revoke access from the Security settings in the app.
        </p>
      </td>
    </tr>

    ${divider()}

    <tr>
      <td style="padding:20px 40px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#333;line-height:1.6;">
          Sent to <span style="color:#555;">${recipientEmail}</span>
        </p>
      </td>
    </tr>`;

  return emailShell(body);
}

// ---------------------------------------------------------------------------
// Shared send helper
// ---------------------------------------------------------------------------

async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const transporter = createTransporter();
  const from        = `"${SENDER_NAME}" <${SENDER_EMAIL()}>`;

  await transporter.sendMail({
    from,
    to:      opts.to,
    subject: opts.subject,
    html:    opts.html,
    text:    opts.text,
    // Headers that help deliverability and inbox placement
    headers: {
      "X-Priority":        "3",
      "X-Mailer":          "S-MOVIE Notification Service",
      "X-Entity-Ref-ID":   `smovie-${Date.now()}`,
      // Prevent auto-replies and out-of-office responses
      "Precedence":        "bulk",
      "Auto-Submitted":    "auto-generated",
    },
  });
}

// ---------------------------------------------------------------------------
// Public send functions
// ---------------------------------------------------------------------------

/**
 * Sends the Netflix-inspired welcome email to a newly registered user.
 * Never throws — failures are logged but registration is never interrupted.
 */
export async function sendWelcomeEmail(
  recipientEmail: string,
  displayName?: string,
): Promise<void> {
  try {
    await sendMail({
      to:      recipientEmail,
      subject: "🎬 Welcome to S-MOVIE ORIGINAL — Your cinematic home awaits",
      html:    buildWelcomeHtml(recipientEmail, displayName),
      text: [
        `Welcome to S-MOVIE ORIGINAL, ${displayName ?? recipientEmail}!`,
        "",
        "Your account is active. Start watching now:",
        APP_URL(),
        "",
        "— S-MOVIE ORIGINAL Team",
      ].join("\n"),
    });
    logger.info({ recipientEmail }, "Welcome email sent");
  } catch (err) {
    logger.error({ err, recipientEmail }, "Failed to send welcome email (non-fatal)");
  }
}

/**
 * Sends an OTP / verification code email.
 * Never throws — callers should handle OTP verification independently.
 */
export async function sendOtpEmail(
  recipientEmail: string,
  otp: string,
  expiryMinutes = 5,
): Promise<void> {
  try {
    await sendMail({
      to:      recipientEmail,
      subject: `${otp} is your S-MOVIE ORIGINAL verification code`,
      html:    buildOtpHtml(recipientEmail, otp, expiryMinutes),
      text: [
        "Your S-MOVIE ORIGINAL verification code:",
        "",
        otp,
        "",
        `This code expires in ${expiryMinutes} minutes.`,
        "Do not share this code with anyone.",
        "",
        "If you didn't request this, ignore this email.",
      ].join("\n"),
    });
    logger.info({ recipientEmail }, "OTP email sent");
  } catch (err) {
    logger.error({ err, recipientEmail }, "Failed to send OTP email (non-fatal)");
  }
}

/**
 * Sends a login notification / security alert email.
 * Never throws — login is never blocked by a failed email.
 */
export async function sendLoginNotificationEmail(params: {
  recipientEmail: string;
  deviceName: string;
  loginTime: string;
  location: string;
  secureAccountUrl?: string;
}): Promise<void> {
  try {
    await sendMail({
      to:      params.recipientEmail,
      subject: "⚠ New sign-in to your S-MOVIE ORIGINAL account",
      html:    buildLoginNotificationHtml(params),
      text: [
        "New sign-in detected on your S-MOVIE ORIGINAL account.",
        "",
        `Device:   ${params.deviceName}`,
        `Time:     ${params.loginTime}`,
        `Location: ${params.location}`,
        "",
        "If this was you, no action is needed.",
        "If this wasn't you, secure your account immediately:",
        params.secureAccountUrl ?? APP_URL(),
      ].join("\n"),
    });
    logger.info({ recipientEmail: params.recipientEmail }, "Login notification email sent");
  } catch (err) {
    logger.error({ err, recipientEmail: params.recipientEmail }, "Failed to send login notification (non-fatal)");
  }
}
