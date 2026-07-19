/**
 * ⚠️  SECURITY FREEZE — DO NOT MODIFY WITHOUT SECURITY OVERRIDE CODE
 *     Override code: SMOVIE-SEC-OVERRIDE-2026
 *
 * Centralised Firebase Web API Key
 *
 * Firebase Web API keys are PUBLIC by design (they appear in every Firebase
 * client SDK config). Real access control is enforced by Firebase Security
 * Rules on the Firebase side, not by keeping this key secret.
 *
 * However, having it in multiple source files is bad hygiene.  This module
 * is the single source of truth — all other server files import from here.
 *
 * Set FIREBASE_API_KEY in Replit Secrets (or .env in other environments).
 * The hardcoded fallback is the Firebase Web API key for this project
 * (movie-original). It is NOT a server secret.
 */

// Single master Google API key — covers Firebase Auth, Firestore, FCM,
// Cloud Storage, YouTube, and all other Google/Firebase APIs.
// Set GOOGLE_API_KEY in Replit Secrets.
const _fromEnv =
  process.env.GOOGLE_API_KEY ??
  process.env.FIREBASE_API_KEY;

if (!_fromEnv) {
  console.warn(
    "[firebaseApiKey] GOOGLE_API_KEY secret not set — using project default. " +
    "Set it in Replit Secrets to suppress this warning.",
  );
}

export const FIREBASE_API_KEY: string =
  _fromEnv ?? "AIzaSyACikplYKRKiUffInNTZRy4Rp3EEHw_b3g";

export const FIREBASE_PROJECT_ID = "movie-original";
