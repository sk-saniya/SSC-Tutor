import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateAnswer } from "@/lib/gemini";
import { retrieveRelevantChunks, chunksToContext } from "@/lib/rag/retrieve";
import { extractTextFromFile } from "@/lib/rag/ingest";
import { buildDiagramImageUrl } from "@/lib/image-gen";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const formData = await request.formData();
  const message = (formData.get("message") as string | null) ?? "";
  const file = formData.get("file") as File | null;

  let imageBase64: string | undefined;
  let imageMimeType: string | undefined;
  let extractedFileText = "";
  let extractedFileLabel: string | null = null;
  let uploadedImagePreviewUrl: string | undefined;

  if (file && file.size > 0) {
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "PDF files are no longer supported as chat attachments. Please upload an image, text file, or audio clip." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (IMAGE_TYPES.includes(file.type)) {
      imageBase64 = buffer.toString("base64");
      imageMimeType = file.type;
      // small data URL so the student's own chat bubble can show what they sent
      uploadedImagePreviewUrl = `data:${file.type};base64,${imageBase64}`;
    } else if (file.type.startsWith("audio/")) {
      // For audio files, store a base64 preview similar to images
      imageBase64 = buffer.toString("base64");
      imageMimeType = file.type;
      uploadedImagePreviewUrl = `data:${file.type};base64,${imageBase64}`;
    } else if (file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt")) {
      // Text files: extract the text and keep a lightweight preview URL
      extractedFileText = await extractTextFromFile(buffer, file.type);
      extractedFileLabel = "text file";
      uploadedImagePreviewUrl = `data:text/plain;base64,${buffer.toString("base64")}`;
    } else {
      try {
        extractedFileText = await extractTextFromFile(buffer, file.type);
      } catch (err) {
        console.error('Failed to extract file text:', err);
        extractedFileText = "";
      }
    }
  }

  const isVoiceInput = file?.type.startsWith("audio/") && !message.trim();
  const ragQuery = message.trim()
    ? message
    : isVoiceInput
    ? "Answer the student's spoken question from the audio"
    : "Answer the questions from the attached document";

  // --- RAG: retrieve relevant NCERT chunks for this question ---
  const chunks = await retrieveRelevantChunks(supabase, ragQuery);
  const context = chunksToContext(chunks);

  // --- pull recent history from the database for conversational context ---
  const { data: historyRows } = await supabase
    .from("messages")
    .select("role, content")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(6);

  const history = (historyRows ?? []).reverse() as {
    role: "user" | "assistant";
    content: string;
  }[];

  const modelQuestion = extractedFileText
    ? `${message}\n\nPlease read the following attached document and answer the questions or fulfill the request within it:\n\n${extractedFileText}`.trim()
    : isVoiceInput
    ? "The student has sent a voice recording. Please first transcribe exactly what the student said, then answer their question as a CBSE Class 10 Science or Math tutor. Their spoken question is in the attached audio."
    : (message || "What can you tell me about this image?");

  const { text, imagePrompt } = await generateAnswer({
    question: modelQuestion,
    context,
    imageBase64,
    imageMimeType,
    history,
  });

  const generatedImageUrl = imagePrompt ? buildDiagramImageUrl(imagePrompt) : null;

  // --- persist both turns in Supabase ---
  let userMessageContent = message || (isVoiceInput ? "🎤 (voice question)" : "(sent a file)");
  if (extractedFileText) {
    userMessageContent = `${userMessageContent}\n\n(Extracted ${extractedFileLabel ?? "file"} text)\n${extractedFileText}`;
  }

  await supabase.from("messages").insert([
    {
      user_id: user.id,
      role: "user",
      content: userMessageContent,
      image_url: uploadedImagePreviewUrl ?? null,
    },
    {
      user_id: user.id,
      role: "assistant",
      content: text,
      image_url: generatedImageUrl,
    },
  ]);

  return NextResponse.json({
    text,
    imageUrl: generatedImageUrl,
    sourcesUsed: chunks.length,
  });
}
