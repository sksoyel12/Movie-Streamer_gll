import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_API_KEY =
  process.env.TMDB_API_KEY_V3 ??
  process.env.TMDB_API_KEY ??
  process.env.EXPO_PUBLIC_TMDB_API_KEY ??
  process.env.EXPO_PUBLIC_TMDB_KEY;

function forwardQuery(req: Request): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "api_key") continue;
    if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, String(entry)));
    } else if (value !== undefined) {
      query.set(key, String(value));
    }
  }
  query.set("api_key", TMDB_API_KEY ?? "");
  query.set("language", query.get("language") ?? "en-US");
  return query.toString();
}

async function tmdbProxy(req: Request, res: Response): Promise<void> {
  if (!TMDB_API_KEY) {
    res.status(503).json({ error: "TMDB proxy is not configured" });
    return;
  }

  const endpoint = req.path.replace(/^\/+/, "");
  if (!endpoint || endpoint.includes("..")) {
    res.status(400).json({ error: "Invalid TMDB endpoint" });
    return;
  }

  try {
    const upstream = await fetch(
      `${TMDB_BASE_URL}/${endpoint}?${forwardQuery(req)}`,
      { headers: { Accept: "application/json" } },
    );
    const body = await upstream.text();
    res.status(upstream.status);
    res.type(upstream.headers.get("content-type") ?? "application/json");
    res.send(body);
  } catch {
    res.status(502).json({ error: "TMDB request failed" });
  }
}

async function imageProxy(req: Request, res: Response): Promise<void> {
  const rawUrl = typeof req.query.url === "string" ? req.query.url : "";
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    res.status(400).json({ error: "A valid image URL is required" });
    return;
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    res.status(400).json({ error: "Unsupported image URL protocol" });
    return;
  }

  try {
    const upstream = await fetch(target, { headers: { Accept: "image/*" } });
    if (!upstream.ok) {
      res.status(upstream.status).end();
      return;
    }
    const contentType = upstream.headers.get("content-type");
    if (contentType) res.type(contentType);
    res.set("Cache-Control", "public, max-age=86400");
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.status(502).json({ error: "Image request failed" });
  }
}

router.use("/tmdb", tmdbProxy);
router.get("/image", imageProxy);

export default router;