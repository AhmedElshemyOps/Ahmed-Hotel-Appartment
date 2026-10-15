import express, { Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "node:url";
import { rateLimit } from "express-rate-limit";
import { cloudPool, createCloudRouter, HttpError } from "./server/cloud";
import { reservationWebhook } from "./server/integration";
import { googleCallback } from "./server/market/google";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const cloudMode = process.env.APP_MODE === "cloud";
const HOST =
  process.env.APP_HOST ||
  (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
if (process.env.NODE_ENV === "production" && !cloudMode)
  throw Error("Production requires APP_MODE=cloud; demo hosting is disabled.");
app.disable("x-powered-by");
app.set("trust proxy", cloudMode ? 1 : false);
app.use((_req, res, next) => {
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "no-referrer");
  res.set("X-Content-Type-Options", "nosniff");
  if (process.env.NODE_ENV === "production") {
    res.set("Strict-Transport-Security", "max-age=31536000");
    res.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
  }
  next();
});
app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
app.use(
  express.json({
    limit: "3mb",
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
);
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  next();
});
app.get("/api/config", (_req, res) =>
  res.json({
    cloudMode,
    firebase: cloudMode
      ? {
          apiKey: process.env.FIREBASE_WEB_API_KEY,
          authDomain: process.env.FIREBASE_AUTH_DOMAIN,
          projectId: process.env.GOOGLE_CLOUD_PROJECT,
        }
      : null,
  }),
);
if (cloudMode) {
  const pool = cloudPool();
  app.get(
    "/integrations/google/callback",
    rateLimit({ windowMs: 60000, limit: 30 }),
    googleCallback(pool),
  );
  app.post(
    "/integrations/reservations",
    rateLimit({ windowMs: 60000, limit: 60 }),
    reservationWebhook(pool),
  );
  // Both cloud data and legacy AI endpoints require a verified MFA session.
  app.use("/api", createCloudRouter(pool));
  // AI does not yet retrieve these records. Keep it unavailable in the cloud workspace.
  app.use("/api/ai", (_req, res) =>
    res
      .status(503)
      .json({ error: "Evidence-backed cloud AI is pending implementation." }),
  );
}

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    brand: "Ahmed Quality Ops",
    service: "Hospitality AI Command Center API",
    hasGeminiApiKey: Boolean(aiClient),
    timestamp: new Date().toISOString(),
  });
});

// Grounded Analytical Fallback Responses (Ensures 100% reliable responses even without API key)
function getGroundedDeterministicResponse(
  _prompt: string,
  _contextData: unknown,
): string {
  return [
    "### Analysis unavailable without verified records",
    "The AI service is unavailable or not configured. No operational figures have been inferred.",
    "Please use the dashboard for calculated metrics, or reconnect the AI service after verifying the data source.",
    "**Approval:** No action has been executed.",
  ].join("\n\n");
}

// POST /api/ai/chat — Ask the AI Hotel Manager
app.post("/api/ai/chat", async (req: Request, res: Response) => {
  try {
    const { prompt, conversationHistory, propertyContext } = req.body;

    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 4000) {
      return res.status(400).json({ error: "Missing prompt parameter" });
    }

    // If Gemini client is configured with a valid key, call live model
    if (aiClient) {
      try {
        const systemInstruction = `You are the executive AI Hotel Manager for "Ahmed Quality Ops — Hospitality AI Command Center", an advanced hotel and serviced apartment intelligence platform in Dubai, UAE.
Currency: AED.
Total Inventory: 40 Serviced Apartments (Units 101-116 Studios, 201-212 1-Bed, 301-308 2-Bed, 401-404 3-Bed).
Tone: Authoritative, executive, precise, commercial, and operationally rigorous.
Fundamental Principle: AI analyzes, explains, and recommends; authorized hotel leaders make decisions.
Never invent numbers. Cite verified operational metrics: Occupancy, ADR, RevPAR, NOI, Maintenance costs, ALOS, and Guest complaints.
If reporting on specific apartments (e.g., Unit 205 HVAC compressor breakdown, Unit 304 plumbing leak), reference actual work order IDs, verified AED costs, and out-of-order room nights.
Format responses with clean Markdown headers, bullet points, and actionable executive summaries.`;

        // Client-supplied context is untrusted. Do not label it verified or insert default metrics.
        const fullPrompt =
          "UNVERIFIED USER QUESTION (no server-validated property records are available):\n" +
          prompt +
          "\nDo not provide numerical property claims or assert that records were reconciled. Ask for a verified data connection.";

        const response = await aiClient.models.generateContent({
          model: "gemini-3.8-flash",
          contents: fullPrompt,
          config: {
            systemInstruction,
          },
        });

        const replyText =
          response.text ||
          getGroundedDeterministicResponse(prompt, propertyContext);

        return res.json({
          reply: replyText,
          source: "Gemini response (property data not independently verified)",
          isLiveModel: true,
          timestamp: new Date().toISOString(),
        });
      } catch (geminiError: any) {
        console.warn(
          "Gemini API call failed, falling back to verified deterministic engine:",
          geminiError?.message,
        );
        const fallbackReply = getGroundedDeterministicResponse(
          prompt,
          propertyContext,
        );
        return res.json({
          reply: fallbackReply,
          source: "Safe unavailable-data fallback",
          isLiveModel: false,
          fallbackReason: geminiError?.message || "Gemini service unreachable",
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Deterministic Rule-Based Engine (when no live API key is configured)
    const fallbackReply = getGroundedDeterministicResponse(
      prompt,
      propertyContext,
    );
    return res.json({
      reply: fallbackReply,
      source: "Safe unavailable-data fallback",
      isLiveModel: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in /api/ai/chat:", error);
    return res.status(500).json({
      error: "Failed to process AI manager query",
      details: error?.message || "Unknown server error",
    });
  }
});

app.use("/api", (_req, res) =>
  res.status(404).json({ error: "API endpoint not found." }),
);

// Setup Vite or static serving
async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "dist",
    );
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.use(
    (error: any, _req: Request, res: Response, _next: express.NextFunction) => {
      const status =
        error instanceof HttpError
          ? error.status
          : error.type === "entity.too.large"
            ? 413
            : error.type === "entity.parse.failed"
              ? 400
              : 500;
      res.status(status).json({
        error:
          error instanceof HttpError
            ? error.message
            : status === 413
              ? "File is too large."
              : status === 400
                ? "Invalid JSON request."
                : "Request failed. Retry or contact your administrator.",
      });
    },
  );
  app.listen(PORT, HOST, () => {
    console.log(
      `[Ahmed Quality Ops] Hospitality AI Command Center active on http://${HOST}:${PORT}`,
    );
    console.log(
      `[Ahmed Quality Ops] Gemini AI Server-Side integration: ${aiClient ? "ACTIVE" : "DETERMINISTIC FALLBACK READY"}`,
    );
  });
}

startServer().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
