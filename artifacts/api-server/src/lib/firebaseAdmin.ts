/**
 * Firebase Admin SDK — singleton initialisation.
 *
 * Required environment variables (from your Firebase project's Service Account):
 *   FIREBASE_PROJECT_ID      — e.g. "smovie-abc12"
 *   FIREBASE_CLIENT_EMAIL    — e.g. "firebase-adminsdk-xxx@smovie-abc12.iam.gserviceaccount.com"
 *   FIREBASE_PRIVATE_KEY     — the RSA private key (paste the whole -----BEGIN … END----- block)
 *
 * The admin SDK is initialised lazily on first call to getAdmin().
 * If credentials are missing, functions that require admin access log a warning and return null.
 */

import * as adminPkg from "firebase-admin";
import type { App } from "firebase-admin/app";
import { logger } from "./logger";

// firebase-admin ships CJS; unwrap the default export when bundled via ESM interop
const admin = (adminPkg as any).default ?? adminPkg;

let _app: App | null = null;
let _initAttempted = false;

function initAdmin(): App | null {
  if (_initAttempted) return _app;
  _initAttempted = true;

  const projectId   = process.env["FIREBASE_PROJECT_ID"];
  const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"];
  const privateKey  = process.env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    logger.warn(
      "Firebase Admin not initialised — FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, " +
      "and FIREBASE_PRIVATE_KEY must all be set. Cron emails will be skipped.",
    );
    return null;
  }

  try {
    if (admin.apps?.length) {
      _app = admin.apps[0] as App;
    } else {
      _app = admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        projectId,
      });
    }
    logger.info({ projectId }, "Firebase Admin initialised");
  } catch (err) {
    logger.error({ err }, "Firebase Admin initialisation failed");
    _app = null;
  }

  return _app;
}

/** Returns the initialised Admin App, or null if credentials are missing. */
export function getAdmin(): App | null {
  return initAdmin();
}

/** Returns a Firestore instance, or null if admin is not available. */
export function getFirestore() {
  const app = initAdmin();
  if (!app) return null;
  try {
    return admin.firestore(app);
  } catch {
    return null;
  }
}

/** Returns the Firebase Auth service, or null if admin is not available. */
export function getAuth() {
  const app = initAdmin();
  if (!app) return null;
  try {
    return admin.auth(app);
  } catch {
    return null;
  }
}
