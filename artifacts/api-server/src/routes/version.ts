import { Router, type IRouter } from "express";

const router: IRouter = Router();

/**
 * GET /api/version
 *
 * Update this payload whenever a new APK build is shipped.
 * - version / latestVersion: semver string the app compares against CURRENT_VERSION
 * - versionCode: monotonically increasing integer (matches eas build versionCode)
 * - apkUrl: direct HTTPS link to download the .apk artifact
 * - releaseNotes: short changelog shown in the update dialog
 * - forceUpdate: when true the app shows a non-dismissible update dialog
 */
router.get("/version", (_req, res) => {
  res.json({
    version: "2.2.0",
    latestVersion: "2.2.0",
    versionCode: 6,
    releaseNotes:
      "Premium app icon, high-conversion marketing page, built-in proxy network upgrade, ad-free stream engine improvements, and rock-solid update checker with direct APK delivery.",
    apkUrl:
      "https://expo.dev/artifacts/v1/production-builds/android/apk/stable-s-movie-release.apk",
    forceUpdate: false,
  });
});

export default router;
