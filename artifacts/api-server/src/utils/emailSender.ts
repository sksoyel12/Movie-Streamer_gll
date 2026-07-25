import nodemailer from "nodemailer";
import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Transporter
// ---------------------------------------------------------------------------

function createTransporter() {
  const user = process.env["EMAIL_USER"];
  const pass = process.env["EMAIL_PASS"];

  if (!user || !pass) {
    throw new Error(
      "EMAIL_USER and EMAIL_PASS environment variables must be set to send emails.",
    );
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

// ---------------------------------------------------------------------------
// HTML Template — Netflix-inspired welcome email
// ---------------------------------------------------------------------------

function buildWelcomeHtml(recipientEmail: string): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to S-MOVIE</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#141414;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#141414;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Card -->
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background-color:#1a1a1a;border-radius:12px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.6);">

          <!-- ── Header ── -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a1a 0%,#2a0a0a 100%);padding:40px 48px 32px;border-bottom:3px solid #e50914;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <!-- Wordmark -->
                    <div style="display:inline-block;">
                      <span style="font-size:28px;font-weight:900;letter-spacing:6px;color:#e50914;text-transform:uppercase;">S-MOVIE</span>
                      <span style="display:block;font-size:9px;letter-spacing:5px;color:#888;text-transform:uppercase;margin-top:2px;">ORIGINAL</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Hero ── -->
          <tr>
            <td style="padding:56px 48px 40px;text-align:center;">
              <!-- Icon -->
              <div style="width:72px;height:72px;background:linear-gradient(135deg,#e50914,#b00710);border-radius:50%;margin:0 auto 32px;display:flex;align-items:center;justify-content:center;">
                <span style="font-size:32px;line-height:72px;">🎬</span>
              </div>

              <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;letter-spacing:-0.5px;">
                Welcome to your new<br/>cinematic home.
              </h1>

              <p style="margin:0 0 12px;font-size:16px;color:#aaaaaa;line-height:1.6;">
                Hey there — we're thrilled to have you join S-MOVIE.
              </p>
              <p style="margin:0 0 40px;font-size:16px;color:#aaaaaa;line-height:1.6;">
                Your account is ready. Thousands of films and series are
                waiting for you — all in one place, whenever you want them.
              </p>

              <!-- CTA Button -->
              <a href="${process.env["APP_URL"] ?? "https://s-movie.replit.app"}"
                 style="display:inline-block;background:linear-gradient(135deg,#e50914,#c2080f);color:#ffffff;font-size:16px;font-weight:700;letter-spacing:0.5px;text-decoration:none;padding:16px 48px;border-radius:6px;text-transform:uppercase;">
                Start Watching
              </a>
            </td>
          </tr>

          <!-- ── Feature strip ── -->
          <tr>
            <td style="padding:0 48px 48px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background-color:#242424;border-radius:8px;overflow:hidden;">
                <tr>
                  <td width="33%" style="padding:24px 16px;text-align:center;border-right:1px solid #333;">
                    <div style="font-size:24px;margin-bottom:8px;">📺</div>
                    <div style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1px;">HD Streaming</div>
                    <div style="font-size:11px;color:#888;margin-top:4px;">Crystal-clear quality</div>
                  </td>
                  <td width="33%" style="padding:24px 16px;text-align:center;border-right:1px solid #333;">
                    <div style="font-size:24px;margin-bottom:8px;">⬇️</div>
                    <div style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1px;">Downloads</div>
                    <div style="font-size:11px;color:#888;margin-top:4px;">Watch offline</div>
                  </td>
                  <td width="34%" style="padding:24px 16px;text-align:center;">
                    <div style="font-size:24px;margin-bottom:8px;">🤖</div>
                    <div style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1px;">AI Features</div>
                    <div style="font-size:11px;color:#888;margin-top:4px;">Smart recommendations</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Divider ── -->
          <tr>
            <td style="padding:0 48px;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,#333,transparent);"></div>
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="padding:32px 48px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:#555;line-height:1.5;">
                This email was sent to <span style="color:#888;">${recipientEmail}</span>
              </p>
              <p style="margin:0 0 16px;font-size:12px;color:#555;line-height:1.5;">
                If you didn't create an account, you can safely ignore this email.
              </p>
              <p style="margin:0;font-size:11px;color:#444;letter-spacing:1px;text-transform:uppercase;">
                S-MOVIE &nbsp;·&nbsp; All rights reserved
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sends a Netflix-inspired welcome email to a newly registered user.
 *
 * Failures are logged but **never** thrown — the caller's registration flow
 * must not be interrupted by a transient email error.
 */
export async function sendWelcomeEmail(recipientEmail: string): Promise<void> {
  try {
    const transporter = createTransporter();

    const senderName = "S-MOVIE";
    const senderEmail = process.env["EMAIL_USER"] ?? "";

    await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: recipientEmail,
      subject: "🎬 Welcome to S-MOVIE — Your cinematic home awaits",
      html: buildWelcomeHtml(recipientEmail),
      // Plain-text fallback for email clients that can't render HTML
      text: [
        "Welcome to S-MOVIE!",
        "",
        "Your account is ready. Thousands of films and series are waiting for you.",
        "",
        `Start watching: ${process.env["APP_URL"] ?? "https://s-movie.replit.app"}`,
        "",
        "— The S-MOVIE Team",
      ].join("\n"),
    });

    logger.info({ recipientEmail }, "Welcome email sent successfully");
  } catch (err) {
    // Log the error but do NOT re-throw — registration must not fail because of email.
    logger.error({ err, recipientEmail }, "Failed to send welcome email (non-fatal)");
  }
}
