/**
 * Anti-bot / anti-scraper middleware.
 *
 * Checks:
 *   1. X-S-Movie-Client header must be present (app always sends it)
 *   2. User-Agent must not match known scraper/bot patterns
 *   3. Requests with no UA at all are blocked
 *
 * These checks complement Firebase auth — together they stop:
 *   - Casual curl/Postman probes (no custom header)
 *   - Automated scrapers (bot UA strings)
 *   - Scripts that bypass the mobile app (missing app signature)
 */

import { type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";

const CLIENT_HEADER = "x-s-movie-client";
const VALID_CLIENTS = new Set(["SMovie-Android/1.0", "SMovie-iOS/1.0", "SMovie-Web/1.0"]);

const BOT_UA_RE = /^(curl|wget|python-requests|python-httpx|go-http|java\/|okhttp|axios\/|node-fetch|scrapy|libwww|bot|spider|crawl|headless|phantom|playwright|puppeteer|selenium)/i;

export async function antiBot(req: Request, res: Response, next: NextFunction) {
  const ua     = req.headers["user-agent"] ?? "";
  const client = req.headers[CLIENT_HEADER] as string | undefined;

  // 1. Block requests with no User-Agent at all
  if (!ua) {
    logger.warn({ ip: req.ip, path: req.path }, "Blocked: no User-Agent");
    res.status(403).json({ error: "Forbidden", code: "BOT_DETECTED" });
    return;
  }

  // 2. Block known bot/scraper User-Agents
  if (BOT_UA_RE.test(ua)) {
    logger.warn({ ip: req.ip, ua, path: req.path }, "Blocked: bot User-Agent");
    res.status(403).json({ error: "Forbidden", code: "BOT_DETECTED" });
    return;
  }

  // 3. Require the custom client header.
  //    Missing/invalid header → serve honeypot decoy data instead of revealing the protection.
  //    Scrapers see a 200 with realistic-looking encrypted URLs that will never play.
  if (!client || !VALID_CLIENTS.has(client)) {
    logger.info({ ip: req.ip, path: req.path }, "Honeypot: invalid client header → decoy");
    const { decoyStreamResponse, decoyRaceResponse, decoyScrapeMultiResponse, decoyScraperResponse } =
      await import("../lib/decoyGenerator");

    const delay = Math.floor(Math.random() * 1500) + 300;
    await new Promise((r) => setTimeout(r, delay));

    const path = req.path;
    if (path.includes("/stream/race"))    return void res.json(decoyRaceResponse());
    if (path.includes("/scrape"))         return void res.json(decoyScrapeMultiResponse());
    if (path.includes("/stream"))         return void res.json(decoyStreamResponse());
    return void res.json(decoyScraperResponse()); // /get-stream, /vegamovies
  }

  next();
}
