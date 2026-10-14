import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    brand: 'Ahmed Quality Ops',
    service: 'Hospitality AI Command Center API',
    hasGeminiApiKey: Boolean(aiClient),
    timestamp: new Date().toISOString(),
  });
});

// Grounded Analytical Fallback Responses (Ensures 100% reliable responses even without API key)
function getGroundedDeterministicResponse(_prompt: string, _contextData: unknown): string {
  return [
    '### Analysis unavailable without verified records',
    'The AI service is unavailable or not configured. No operational figures have been inferred.',
    'Please use the dashboard for calculated metrics, or reconnect the AI service after verifying the data source.',
    '**Approval:** No action has been executed.'
  ].join('\n\n');
}

// POST /api/ai/chat — Ask the AI Hotel Manager
app.post('/api/ai/chat', async (req: Request, res: Response) => {
  try {
    const { prompt, conversationHistory, propertyContext } = req.body;

    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000) {
      return res.status(400).json({ error: 'Missing prompt parameter' });
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
        const fullPrompt = 'UNVERIFIED USER QUESTION (no server-validated property records are available):\n' + prompt +
          '\nDo not provide numerical property claims or assert that records were reconciled. Ask for a verified data connection.';

        const response = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: fullPrompt,
          config: {
            systemInstruction,
          },
        });

        const replyText = response.text || getGroundedDeterministicResponse(prompt, propertyContext);

        return res.json({
          reply: replyText,
          source: 'Gemini response (property data not independently verified)',
          isLiveModel: true,
          timestamp: new Date().toISOString(),
        });
      } catch (geminiError: any) {
        console.warn('Gemini API call failed, falling back to verified deterministic engine:', geminiError?.message);
        const fallbackReply = getGroundedDeterministicResponse(prompt, propertyContext);
        return res.json({
          reply: fallbackReply,
          source: 'Safe unavailable-data fallback',
          isLiveModel: false,
          fallbackReason: geminiError?.message || 'Gemini service unreachable',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Deterministic Rule-Based Engine (when no live API key is configured)
    const fallbackReply = getGroundedDeterministicResponse(prompt, propertyContext);
    return res.json({
      reply: fallbackReply,
      source: 'Safe unavailable-data fallback',
      isLiveModel: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in /api/ai/chat:', error);
    return res.status(500).json({
      error: 'Failed to process AI manager query',
      details: error?.message || 'Unknown server error',
    });
  }
});

// Setup Vite or static serving
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Ahmed Quality Ops] Hospitality AI Command Center active on http://0.0.0.0:${PORT}`);
    console.log(`[Ahmed Quality Ops] Gemini AI Server-Side integration: ${aiClient ? 'ACTIVE' : 'DETERMINISTIC FALLBACK READY'}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
