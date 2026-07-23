---
name: Firebase preview configuration
description: Public Firebase configuration behavior needed for the Expo preview to boot reliably.
---

The Expo preview must retain a valid public Firebase web API-key fallback while environment configuration is being provisioned. An empty Firebase `apiKey` does not merely disable auth; Firebase initialization can throw `auth/invalid-api-key` during app startup and prevent every route from rendering.

**Why:** The shared environment did not contain the requested Expo Firebase API-key variable, and initializing Firebase with an empty key caused the profile preview to crash before UI validation.

**How to apply:** Prefer `EXPO_PUBLIC_FIREBASE_API_KEY` (or the existing Google API-key variable) when present, but preserve the known public project fallback until deployment environments are guaranteed to provide the value.