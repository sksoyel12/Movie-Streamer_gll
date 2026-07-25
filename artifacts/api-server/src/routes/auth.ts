import { Router } from "express";
import { sendWelcomeEmail } from "../utils/emailSender";
import { logger } from "../lib/logger";

const authRouter = Router();

/**
 * POST /api/auth/welcome-email
 *
 * Called by the client immediately after Firebase creates a new user account.
 * Sends a welcome email to the new user.
 *
 * Body: { email: string }
 *
 * The endpoint always returns 200 — email delivery is best-effort and must
 * never block or roll back the user's registration.
 */
authRouter.post("/auth/welcome-email", async (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ success: false, message: "A valid email address is required." });
    return;
  }

  logger.info({ email }, "Welcome email requested for new user");

  // sendWelcomeEmail never throws — failures are logged internally.
  await sendWelcomeEmail(email);

  res.status(200).json({ success: true, message: "Welcome email dispatched." });
});

export default authRouter;
