---
name: Navigation crash root cause
description: Why clicking any poster caused the app to go back to splash/onboarding
---

## The Bug
`app/movie/[id].tsx` had auth gate: onAuthStateChanged → if user=null → router.replace("/onboarding"). Since home screen has no auth gate, any unauthenticated user tapping a poster got immediately redirected to onboarding. Users experience this as "crash to splash screen".

## Fix Applied
Removed router.replace("/onboarding") from auth check. Detail page is now accessible without auth — only the streaming/play action should gate on auth. Added 3-second safety timeout so page renders even if Firebase doesn't respond.

**Why:** Home screen accessible without login → detail page must be too.

**How to apply:** Never redirect unauthenticated users away from browse/detail pages. Only gate the play/stream action.
