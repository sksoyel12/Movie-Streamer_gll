import { Router } from "express";

const router: Router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

import { FIREBASE_API_KEY, FIREBASE_PROJECT_ID } from "../lib/firebaseApiKey";
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/support_tickets?key=${FIREBASE_API_KEY}`;

const SUPPORT_EMAIL = "wftis.aryux07@gmail.com";

const SYSTEM_PROMPT_TURN = `You are Support Bot for S-Movie Original app — a highly intelligent, all-knowing assistant with complete knowledge of the entire world. You can speak and understand every language in the world.

Language Detection Rule (MOST IMPORTANT):
- Detect the language the user is writing in and ALWAYS reply in that exact same language.
- If user writes in Hindi → reply in Hindi. If in English → reply in English. If in Urdu → reply in Urdu. If in Tamil → reply in Tamil. If in Spanish → reply in Spanish. If in Arabic → reply in Arabic. If in French → reply in French. And so on for every language.
- If user mixes languages (like Hinglish), match that same mix naturally.
- NEVER force a language on the user. Always mirror their language choice.

Tone Rules (MUST follow strictly):
- Be friendly, warm, and conversational.
- Respect the user, address them politely according to their language's cultural norms.
- Be clear and helpful. Keep replies concise — 2-4 lines unless more detail is needed.
- NEVER use Markdown formatting. No bold (**text**), no bullet points (* item), no asterisks, no headers (#). Plain text only.
- Never start with generic filler phrases.

Contact Details (share these when user needs human support):
- Support Email: ${SUPPORT_EMAIL}
- WhatsApp Channel (updates/news): https://whatsapp.com/channel/0029VbDWXSE6RGJ9qR1sw83N
- WhatsApp Direct Chat (support only): https://api.whatsapp.com/send?phone=917098245847
- When a user has an issue that needs human attention, guide them to email ${SUPPORT_EMAIL} or WhatsApp chat above.

Your Knowledge (you know EVERYTHING):
- Science, technology, mathematics, coding, AI, space, medicine, biology, chemistry, physics
- History, geography, politics, current events, world leaders, countries, cultures
- Movies, TV shows, sports, music, celebrities, entertainment (all languages, all countries)
- Food, travel, health, fitness, finance, business, law, education
- S-Movie Original app — support, navigation, troubleshooting, account, downloads, playback
- Any other topic a human might ask about

Rules:
- Always give accurate, helpful, direct answers.
- If uncertain, say so honestly but still try to help as much as possible.
- If a user reports an app problem or complaint, acknowledge it warmly and tell them their issue has been noted. Also mention they can email ${SUPPORT_EMAIL} or WhatsApp for faster help.
- NEVER refuse to answer a general knowledge question. You are here to help with everything.

Understood? Confirm you are ready.`;

const TICKET_KEYWORDS = [
  "problem", "issue", "complaint", "form", "live chat", "live agent", "agent",
  "help form", "dikkat", "mushkil", "ticket", "kaam nahi", "nahi chal", "nahi ho raha",
  "band ho gaya", "error", "real person", "human", "manager", "escalate",
  "support form", "submit", "report", "contact", "bata do", "pareshani",
];

function isTicketIntent(msg: string): boolean {
  const lower = msg.toLowerCase();
  return TICKET_KEYWORDS.some((kw) => lower.includes(kw));
}

async function saveTicket(userId: string | null, message: string): Promise<boolean> {
  try {
    const body = {
      fields: {
        userId: { stringValue: userId ?? "anonymous" },
        message: { stringValue: message },
        timestamp: { timestampValue: new Date().toISOString() },
        status: { stringValue: "pending" },
      },
    };

    const res = await fetch(FIRESTORE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return res.ok;
  } catch {
    return false;
  }
}

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

const SYSTEM_PREAMBLE: GeminiContent[] = [
  { role: "user", parts: [{ text: SYSTEM_PROMPT_TURN }] },
  { role: "model", parts: [{ text: "Ready! I am Support Bot — I know everything about the world and I speak every language. I will always reply in whatever language you write to me. Ask me anything!" }] },
];

const FALLBACK_REPLIES: Record<string, string> = {
  offTopic: "Sir, kuch bhi poochh sakte hain Aap — science, history, movies, sports, technology, ya koi bhi topic.",
  generic: "Sir, abhi response mein thodi dikkat aa rahi hai. Thodi der mein dobara try karein.",
};

/**
 * POST /api/chat
 *
 * Proxies messages to the Gemini 2.5 Flash API.
 * Accepts: { history: GeminiContent[], message: string, userId?: string }
 * Returns: { reply: string, ticketSaved?: boolean }
 */
router.post("/chat", async (req, res) => {
  const { history, message, userId } = req.body as {
    history?: GeminiContent[];
    message?: string;
    userId?: string | null;
  };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  if (!GEMINI_API_KEY) {
    res.json({ reply: FALLBACK_REPLIES.generic });
    return;
  }

  const ticketIntent = isTicketIntent(message);
  let ticketSaved = false;

  if (ticketIntent) {
    ticketSaved = await saveTicket(userId ?? null, message);
  }

  const contents: GeminiContent[] = [
    ...SYSTEM_PREAMBLE,
    ...(Array.isArray(history) ? history : []),
    { role: "user", parts: [{ text: message }] },
  ];

  if (ticketSaved) {
    contents.push({
      role: "user",
      parts: [{ text: "[SYSTEM NOTE: User's issue has been saved as a support ticket. Acknowledge this warmly in your reply using 'Aap' and 'Sir'. Say their issue has been noted and team will resolve it soon. Do NOT use markdown.]" }],
    });
  }

  const body = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
  };

  try {
    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!geminiRes.ok) {
      res.json({ reply: FALLBACK_REPLIES.generic, ticketSaved });
      return;
    }

    const data = (await geminiRes.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };

    if (data?.promptFeedback?.blockReason) {
      res.json({ reply: FALLBACK_REPLIES.offTopic, ticketSaved });
      return;
    }

    const rawReply = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!rawReply) {
      res.json({ reply: ticketSaved ? "Ji Sir, aapka issue humne note kar liya hai aur hamari team ko bhej diya gaya hai. Jaldi resolve kar denge." : FALLBACK_REPLIES.generic, ticketSaved });
      return;
    }

    const cleanReply = rawReply
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*[-*]\s+/gm, "")
      .trim();

    res.json({ reply: cleanReply, ticketSaved });
  } catch {
    res.json({ reply: FALLBACK_REPLIES.generic, ticketSaved });
  }
});

export default router;
