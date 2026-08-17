import { GoogleGenerativeAI } from "@google/generative-ai";

let cachedClient: GoogleGenerativeAI | null = null;

export function getGemini(): GoogleGenerativeAI {
  if (cachedClient) return cachedClient;
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. Set it in .env.local before running extraction."
    );
  }
  cachedClient = new GoogleGenerativeAI(key);
  return cachedClient;
}

export const DEFAULT_MODEL = "gemini-3.6-flash";

/**
 * Send a single image + prompt to Gemini and parse the JSON response.
 * Throws if the response cannot be validated against the schema.
 */
export async function extractFromImage<T>(args: {
  imageBytes: Uint8Array;
  mimeType: string;
  prompt: string;
  schema: { parse: (x: unknown) => T };
  model?: string;
}): Promise<T> {
  const gen = getGemini();
  const model = gen.getGenerativeModel({
    model: args.model ?? DEFAULT_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: args.prompt },
          {
            inlineData: {
              data: Buffer.from(args.imageBytes).toString("base64"),
              mimeType: args.mimeType,
            },
          },
        ],
      },
    ],
  });

  const text = result.response.text();
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`Gemini response was not valid JSON: ${text.slice(0, 200)}`);
  }
  return args.schema.parse(parsed);
}