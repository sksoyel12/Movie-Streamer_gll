---
name: Auth and watch progress
description: Session ownership and Continue Watching persistence rules for the mobile app.
---

Firebase Auth is the single source of truth for the signed-in session. Profile UI should subscribe to Firebase auth state rather than treating a cached AsyncStorage account or a guest marker as authenticated. Signed-in playback progress belongs in the `user_progress` Firestore collection and is queried by the authenticated user ID; AsyncStorage remains the local fallback for guests or temporary Firestore failures.

**Why:** Cached guest/account markers could leave My Profile out of sync with Firebase, and device-only watch progress could not follow a user across Home, Search, Categories, or devices.

**How to apply:** Update the Firebase user state first, clear stale guest/cache markers on auth changes, write playback checkpoints through the shared progress service, and keep the profile row sorted by the remote `lastWatchedAt` value.