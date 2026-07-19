import { logger } from "./logger";

/**
 * Photo-ID verification analysis.
 *
 * Uses Gemini (same GEMINI_API_KEY already used by routes/chat.ts) as a
 * multimodal check for blur, tampering, and fake/non-ID images. Returns a
 * verdict; the caller (routes/identity.ts) decides suspension based on it.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export interface IdAnalysisVerdict {
  blurry: "yes" | "no" | "uncertain";
  blurScore: number; // 0 (sharp) – 1 (very blurry)
  tampered: "yes" | "no" | "uncertain";
  fakeId: "yes" | "no" | "uncertain";
  isDocument: "yes" | "no" | "uncertain";
  reason: string;
  /** true when the photo passes all checks and can be auto-verified */
  passed: boolean;
}

const ANALYSIS_PROMPT = `You are an automated photo-ID verification checker for a streaming app's account verification flow.

Look at the attached image, which a user submitted as their government-issued photo ID (driving license, passport, national ID card, etc).

Assess it strictly and return ONLY a JSON object (no markdown, no prose) with this exact shape:
{
  "blurry": "yes" | "no" | "uncertain",
  "blurScore": <number 0.0-1.0, 0 = perfectly sharp, 1 = unreadable blur>,
  "tampered": "yes" | "no" | "uncertain",
  "fakeId": "yes" | "no" | "uncertain",
  "isDocument": "yes" | "no" | "uncertain",
  "reason": "<one short sentence explaining the verdict>"
}

Guidance:
- "blurry": yes if text/photo on the ID is not legibly sharp.
- "tampered": yes if there are visible signs of digital editing, mismatched fonts, pasted photo, inconsistent lighting/shadows, or altered text.
- "fakeId": yes if the document looks like a fabricated/novelty ID, a screenshot of a template, or clearly not an authentic government document.
- "isDocument": no if the image is not a photo ID at all (e.g. a random photo, screenshot, meme, blank image).
Be conservative — only answer "yes" when you are reasonably confident.`;

function extractJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

/**
 * Analyzes a base64-encoded photo ID image.
 * Throws only on hard infrastructure failure (e.g. missing key, network error);
 * ambiguous model output resolves to a conservative "uncertain" verdict.
 */
export async function analyzeIdPhoto(
  base64Data: string,
  mimeType: string,
): Promise<IdAnalysisVerdict> {
  const fallback: IdAnalysisVerdict = {
    blurry: "uncertain",
    blurScore: 0.5,
    tampered: "uncertain",
    fakeId: "uncertain",
    isDocument: "uncertain",
    reason: "Automated analysis unavailable — flagged for manual review.",
    passed: false,
  };

  if (!GEMINI_API_KEY) {
    logger.warn("[identityAnalysis] GEMINI_API_KEY not set — cannot analyze photo ID");
    return fallback;
  }

  try {
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            { text: ANALYSIS_PROMPT },
            { inlineData: { mimeType, data: base64Data } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
      },
    };

    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "[identityAnalysis] Gemini request failed");
      return fallback;
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = extractJson(rawText);
    if (!parsed) {
      logger.warn({ rawText }, "[identityAnalysis] Could not parse Gemini verdict");
      return fallback;
    }

    const blurry = (parsed.blurry as string) === "yes" ? "yes" : (parsed.blurry as string) === "no" ? "no" : "uncertain";
    const tampered = (parsed.tampered as string) === "yes" ? "yes" : (parsed.tampered as string) === "no" ? "no" : "uncertain";
    const fakeId = (parsed.fakeId as string) === "yes" ? "yes" : (parsed.fakeId as string) === "no" ? "no" : "uncertain";
    const isDocument = (parsed.isDocument as string) === "yes" ? "yes" : (parsed.isDocument as string) === "no" ? "no" : "uncertain";
    const blurScore = typeof parsed.blurScore === "number" ? Math.min(1, Math.max(0, parsed.blurScore)) : 0.5;
    const reason = typeof parsed.reason === "string" && parsed.reason ? parsed.reason : "No further detail provided.";

    const passed = blurry === "no" && tampered === "no" && fakeId === "no" && isDocument !== "no";

    return { blurry, blurScore, tampered, fakeId, isDocument, reason, passed };
  } catch (err) {
    logger.warn({ err }, "[identityAnalysis] Analysis threw");
    return fallback;
  }
}
