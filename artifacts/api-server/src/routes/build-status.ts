import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Latest build metadata — update LATEST_BUILD_ID after each EAS build is triggered
const LATEST_BUILD_ID = "a0ec667a-0800-481e-b7d1-1f22906a7d06";
const EAS_ACCOUNT = "soyelsk";
const EAS_PROJECT = "s-movie";

/**
 * GET /api/build-status
 *
 * Returns the stored latest build info so the Profile screen can show a
 * "Latest Build" card with a direct link to the EAS dashboard.
 *
 * Update LATEST_BUILD_ID + status here after each new EAS build is triggered.
 * Possible statuses: NEW | IN_QUEUE | IN_PROGRESS | FINISHED | ERRORED | CANCELED
 */
router.get("/build-status", (_req, res) => {
  res.json({
    buildId: LATEST_BUILD_ID,
    status: "IN_PROGRESS",
    platform: "ANDROID",
    dashboardUrl: `https://expo.dev/accounts/${EAS_ACCOUNT}/projects/${EAS_PROJECT}/builds/${LATEST_BUILD_ID}`,
    allBuildsUrl: `https://expo.dev/accounts/${EAS_ACCOUNT}/projects/${EAS_PROJECT}/builds`,
    note: "Build triggered with original S-logo (s-logo.png)",
  });
});

export default router;
