import { Router, type IRouter } from "express";
import healthRouter      from "./health";
import imageRouter       from "./image";
import tmdbRouter        from "./tmdb";
import recentRouter      from "./recent";
import streamRouter      from "./stream";
import scrapeRouter      from "./scrape";
import getStreamRouter   from "./getstream";
import vegaMoviesRouter  from "./vegamovies";
import versionRouter     from "./version";
import buildStatusRouter from "./build-status";
import chatRouter        from "./chat";
import authRouter        from "./auth";
import identityRouter    from "./identity";

import { antiBot }           from "../middleware/antiBot";
import { honeypotAuth }      from "../middleware/honeypot";
import { vpnDetect }         from "../middleware/vpnDetect";
import { velocityDetect }    from "../middleware/velocityDetect";
import { requestSignature }  from "../middleware/requestSignature";
import { streamLimiter }     from "../middleware/rateLimit";
import { blockSuspended }    from "../middleware/blockSuspended";

const router: IRouter = Router();

// ─── Public routes (no auth required) ────────────────────────────────────────
router.use(healthRouter);
router.use(imageRouter);
router.use(tmdbRouter);
router.use(recentRouter);   // GET /api/stream/recent — trending row data
router.use(versionRouter);
router.use(buildStatusRouter);
router.use(chatRouter);
router.use(authRouter);      // auth routes: /auth/phone/send, /auth/phone/verify, /auth/stream-key
router.use(identityRouter);  // identity routes: /identity/google-sync, /identity/me, /identity/verify-photo

// ─── Protected routes — 6-layer security stack ────────────────────────────────
// 1. antiBot        — bot UA block; missing client header → decoy (honeypot)
// 2. vpnDetect      — VPN / proxy / datacenter IP → 403 VPN_DETECTED
// 3. honeypotAuth   — valid Firebase token → real; bad/no token → decoy
// 4. blockSuspended — suspended accounts (failed ID verification) → 403 ACCOUNT_SUSPENDED
// 5. velocityDetect — per-device fingerprint scraper pattern detection → decoy
// 6. requestSignature — HMAC sig + timestamp anti-replay → decoy on mismatch
// 7. streamLimiter  — per-uid rate limit (30 req/min) → 429
const protectedRouter: IRouter = Router();
protectedRouter.use(antiBot);
protectedRouter.use(vpnDetect);
protectedRouter.use(honeypotAuth);
protectedRouter.use(blockSuspended);
protectedRouter.use(velocityDetect);
protectedRouter.use(requestSignature);
protectedRouter.use(streamLimiter);
protectedRouter.use(streamRouter);
protectedRouter.use(scrapeRouter);
protectedRouter.use(getStreamRouter);
protectedRouter.use(vegaMoviesRouter);

router.use(protectedRouter);

export default router;
