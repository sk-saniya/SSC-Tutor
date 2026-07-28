import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Keep this in one place — swap to a newer Gemini model id here if Google
// ships one later, without touching any other file.
export const GEMINI_TEXT_MODEL = "gemini-2.5-flash";
export const GEMINI_EMBED_MODEL = "gemini-embedding-001";
export const EMBED_DIMENSIONS = 768; // must match supabase/schema.sql

/**
 * Embeds a piece of text for storage in document_chunks (RAG ingestion)
 * or for searching against it (RAG retrieval). taskType nudges the
 * embedding model to optimize for the right side of that comparison.
 */
export async function embedText(
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"
): Promise<number[]> {
  const result = await ai.models.embedContent({
    model: GEMINI_EMBED_MODEL,
    contents: text,
    config: {
      outputDimensionality: EMBED_DIMENSIONS,
      taskType,
    },
  });

  const values = result.embeddings?.[0]?.values;
  if (!values) throw new Error("Gemini did not return an embedding");
  return values;
}

type OcrImageInput = {
  mimeType: string;
  data: string;
};

type OcrTextInput = {
  images: OcrImageInput[];
  instruction?: string;
};

/**
 * Uses Gemini as a fallback OCR engine for page images.
 * This is intentionally generic so PDF text extraction can reuse it when
 * a document is scanned and contains little or no embedded text.
 */
export async function extractTextFromImages({
  images,
  instruction,
}: OcrTextInput): Promise<string> {
  if (!images.length) return "";

  const parts: Record<string, unknown>[] = [
    {
      text:
        instruction ??
        "Transcribe all visible text from these document pages. Preserve headings, equations, and line breaks. Return only the transcription.",
    },
    ...images.map((image) => ({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data,
      },
    })),
  ];

  const response = await ai.models.generateContent({
    model: GEMINI_TEXT_MODEL,
    contents: [{ role: "user", parts }],
  });

  return (response.text ?? "").trim();
}

type AnswerInput = {
  question: string;
  context: string; // retrieved NCERT chunks, joined into one block
  imageBase64?: string; // an uploaded photo of a question, if any
  imageMimeType?: string;
  history?: { role: "user" | "assistant"; content: string }[];
};

type AnswerOutput = {
  text: string;
  imagePrompt: string | null;
};

const SYSTEM_PROMPT = `You are a friendly, patient tutor for Indian Class 10 CBSE/NCERT Science and Math students.
Rules:
- Answer ONLY using the "Study material" context below when it's relevant. If the context doesn't cover the question, say so plainly and then answer from general Class 10 syllabus knowledge.
- Explain in clear, simple steps a 15-16 year old can follow. Show full working for numericals (math and physics/chemistry calculations).
- Keep the tone encouraging, never condescending.
- ONLY provide an IMAGE_PROMPT if the question EXPLICITLY asks for a diagram, OR if the concept is highly visual and nearly impossible to explain without one (e.g. a labeled cell diagram, a circuit schematic, a specific geometry figure). For theoretical questions, general explanations, or standard numerical problems, DO NOT output an IMAGE_PROMPT. If you do need one, end your answer with one line in exactly this format:
IMAGE_PROMPT: <a short, plain description of the diagram to draw>
Do not include that line otherwise.`;

/**
 * Calls Gemini with the retrieved RAG context plus (optionally) an
 * uploaded image, and pulls out an IMAGE_PROMPT line if the model asked
 * for one — that line is what api/chat hands off to the image generator.
 */
export async function generateAnswer({
  question,
  context,
  imageBase64,
  imageMimeType,
  history = [],
}: AnswerInput): Promise<AnswerOutput> {
  const historyText = history
    .slice(-6) // keep the prompt small — last few turns are enough context
    .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`)
    .join("\n");

  const promptText = `Study material (may be empty if nothing matched):
${context || "(no matching study material found)"}

${historyText ? `Recent conversation:\n${historyText}\n` : ""}
Student's question: ${question}`;

  const parts: Record<string, unknown>[] = [{ text: promptText }];
  if (imageBase64 && imageMimeType) {
    parts.push({ inlineData: { mimeType: imageMimeType, data: imageBase64 } });
  }

  let response;
  let attempts = 0;
  const maxAttempts = 3;
  let delay = 1000;

  while (attempts < maxAttempts) {
    try {
      response = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: [{ role: "user", parts }],
        config: { systemInstruction: SYSTEM_PROMPT },
      });
      break;
    } catch (err: any) {
      attempts++;
      if (attempts >= maxAttempts) {
        throw err;
      }
      console.warn(`Gemini API error (attempt ${attempts}/${maxAttempts}), retrying in ${delay}ms...`, err.message || err);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }

  const rawText = response?.text ?? "";
  const imageMatch = rawText.match(/IMAGE_PROMPT:\s*(.+)/i);
  const imagePrompt = imageMatch ? imageMatch[1].trim() : null;
  const text = rawText.replace(/IMAGE_PROMPT:\s*.+/i, "").trim();

  return { text, imagePrompt };
}
