/**
 * Email trigger helpers — fire-and-forget calls to the API server.
 *
 * All functions are void and swallow every error so the auth flow is
 * never interrupted by a transient email delivery failure.
 */

import { Platform } from "react-native";
import { API_BASE } from "@/lib/apiBase";

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function post(path: string, body: Record<string, unknown>): void {
  const url = `${API_BASE ?? ""}${path}`;
  fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  })
    .then((res) => {
      if (!res.ok && __DEV__) {
        console.warn(`[EmailTrigger] ${path} → HTTP ${res.status}`);
      }
    })
    .catch((err) => {
      if (__DEV__) console.warn(`[EmailTrigger] ${path} network error (non-fatal):`, err);
    });
}

// ---------------------------------------------------------------------------
// Returns true on the very first sign-in (Firebase creationTime === lastSignInTime)
// ---------------------------------------------------------------------------

export function isFirstTimeUser(metadata: {
  creationTime?: string;
  lastSignInTime?: string;
}): boolean {
  if (!metadata.creationTime || !metadata.lastSignInTime) return false;
  return metadata.creationTime === metadata.lastSignInTime;
}

// ---------------------------------------------------------------------------
// Public triggers
// ---------------------------------------------------------------------------

/**
 * Sends the Netflix-inspired welcome email.
 * Call once immediately after the first-ever Firebase sign-in.
 */
export function triggerWelcomeEmail(email: string, displayName?: string | null): void {
  if (!email) return;
  post("/auth/welcome-email", {
    email,
    ...(displayName ? { displayName } : {}),
  });
}

/**
 * Sends a login-notification / security-alert email.
 * Call on every subsequent (non-first-time) sign-in.
 */
export function triggerLoginNotification(
  email: string,
  deviceName?: string | null,
): void {
  if (!email) return;
  post("/auth/login-notification", {
    email,
    platform:   Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : "Web",
    deviceName: deviceName ?? null,
  });
}

/**
 * Sends an OTP / verification code email.
 * The caller generates `otp` (4–8 numeric digits) and manages verification.
 * @param otp           4–8 digit numeric string (e.g. "847291")
 * @param expiryMinutes How long the code is valid (default 5)
 */
export function triggerOtpEmail(
  email: string,
  otp: string,
  expiryMinutes = 5,
): void {
  if (!email || !otp) return;
  post("/auth/send-otp", { email, otp, expiryMinutes });
}
