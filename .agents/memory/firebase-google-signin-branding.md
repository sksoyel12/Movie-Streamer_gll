---
name: Firebase Google Sign-In consent screen shows firebaseapp.com domain
description: Why Google's OAuth consent screen shows "movie-original.firebaseapp.com" instead of the app's custom domain, and what actually controls it.
---

Google's "to continue to <domain>" line under the app name on the OAuth consent
screen reflects Firebase's `authDomain` (the host that serves Firebase's
`/__/auth/handler` page used by `signInWithPopup`/`signInWithRedirect`) — not
the OAuth consent screen's App name/logo branding in Google Cloud Console.
Updating branding alone never changes this line.

**Why:** the popup/redirect literally navigates to `https://<authDomain>/__/auth/handler`
before returning to the app, so Google reports whatever domain that page is
hosted on.

**How to apply:** `authDomain` in `artifacts/s-movie/lib/firebase.ts` must stay
on the Firebase-managed `movie-original.firebaseapp.com` host for Replit
dev/preview domains, because Replit domains don't serve that handler page. To
show a custom domain in production, the domain must first be connected via
Firebase Hosting (Console → Hosting → Add custom domain), added as an
Authorized domain in Firebase Auth settings, and added to the relevant OAuth
client's Authorized JavaScript origins/redirect URIs in Google Cloud Console —
only then does setting `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` to that domain (an
env override added to `firebase.ts`) actually work; setting it without those
three steps breaks sign-in entirely.
