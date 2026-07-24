---
name: Playback and downloads
description: Durable distinction between embedded streaming pages and direct media files in the S-Movie app.
---

Embedded provider URLs are HTML pages for WebView playback, not downloadable media files. Treat only verified direct HTTP(S) media URLs as native-player or offline-download inputs; otherwise show a streaming-only state rather than saving HTML as an MP4.

**Why:** A prior flow passed embed URLs to the native video player and Expo FileSystem, producing playback failures and fake completed downloads. The API currently exposes TMDB/image proxy routes but not the direct-stream scraper routes the client expects.

**How to apply:** Keep embed fallback fast and separate from native media handling. If direct downloads are required, add and verify server-side stream resolution before enabling them; do not restore the old hard-coded build or embed URL fallbacks as downloadable assets.