import { SupabaseClient } from "@supabase/supabase-js";
import { embedText, extractTextFromImages } from "@/lib/gemini";
import { chunkText } from "@/lib/rag/chunk";

const OCR_MIN_TEXT_LENGTH = 120;
const OCR_MAX_PAGES = 3;
const OCR_RENDER_SCALE = 1.75;

async function extractPdfText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfModule = require("pdf-parse");

  let extractedText = "";

  // Support pdf-parse v2.4.5+ which exports a PDFParse class
  if (pdfModule.PDFParse) {
    const parser = new pdfModule.PDFParse({ data: buffer });
    const result = await parser.getText({});
    extractedText = result.text ?? "";
  } else {
    // Fallback for older versions of pdf-parse
    const parseFn = typeof pdfModule === "function" ? pdfModule : (pdfModule.default || pdfModule);
    const data = await parseFn(buffer);
    extractedText = data.text ?? "";
  }

  const normalizedText = extractedText.trim();
  if (normalizedText.length >= OCR_MIN_TEXT_LENGTH) {
    return normalizedText;
  }

  try {
    const [{ getDocument }, { createCanvas }] = await Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("@napi-rs/canvas"),
    ]);

    const loadingTask = getDocument({
      data: buffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
    }).promise;

    const pdf = await loadingTask;
    try {
      const pageCount = Math.min(pdf.numPages, OCR_MAX_PAGES);
      const pageImages: { mimeType: string; data: string }[] = [];

      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext("2d");

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        const pngBuffer = canvas.toBuffer("image/png");
        pageImages.push({
          mimeType: "image/png",
          data: pngBuffer.toString("base64"),
        });
      }

      if (!pageImages.length) {
        return normalizedText;
      }

      const ocrText = await extractTextFromImages({
        images: pageImages,
        instruction:
          "Transcribe the text from these PDF pages. Preserve headings, lists, equations, and line breaks. Return only the transcription.",
      });

      return [normalizedText, ocrText].filter(Boolean).join("\n\n").trim();
    } finally {
      await pdf.destroy();
    }
  } catch (error) {
    console.warn("PDF OCR fallback failed:", error);
    return normalizedText;
  }
}

/**
 * Extracts plain text from an uploaded knowledge-base file.
 * Supports .txt directly and .pdf via pdf-parse. Images aren't accepted
 * here on purpose — the knowledge base should be real syllabus text;
 * a photographed question from a student goes through api/chat instead.
 */
export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === "text/plain" || !mimeType) {
    return buffer.toString("utf-8");
  }

  if (mimeType === "application/pdf") {
    return extractPdfText(buffer);
  }

  // Fallback for .csv, .md, etc that might have different mime types
  if (mimeType.startsWith("text/")) {
    return buffer.toString("utf-8");
  }

  throw new Error(`Unsupported knowledge-base file type: ${mimeType}`);
}

/**
 * The ingestion half of RAG: chunk the source text, embed every chunk,
 * and store it against a new documents row. Run once per chapter/topic
 * you want the chatbot to be able to cite.
 */
export async function ingestDocument(
  supabase: SupabaseClient,
  {
    title,
    subject,
    chapter,
    text,
  }: { title: string; subject: "science" | "math"; chapter?: string; text: string }
) {
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({ title, subject, chapter })
    .select()
    .single();

  if (docError || !doc) {
    throw new Error(docError?.message ?? "Failed to create document row");
  }

  const chunks = chunkText(text);

  for (const content of chunks) {
    const embedding = await embedText(content, "RETRIEVAL_DOCUMENT");
    const { error } = await supabase.from("document_chunks").insert({
      document_id: doc.id,
      content,
      embedding,
    });
    if (error) console.error("Failed to insert chunk:", error.message);
  }

  return { documentId: doc.id, chunkCount: chunks.length };
}
