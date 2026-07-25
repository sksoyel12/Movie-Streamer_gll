import { Router, type IRouter } from "express";
import healthRouter from "./health";
import proxyRouter from "./proxy";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(proxyRouter);
router.use(authRouter);

export default router;
