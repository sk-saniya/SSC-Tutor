import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("audio") as File | null;

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const audioBase64 = buffer.toString("base64");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "Please transcribe the speech in this audio recording. Output ONLY the transcribed text — no labels, no explanations, no punctuation changes. Just write exactly what was said.",
            },
            {
              inlineData: {
                mimeType: file.type || "audio/webm",
                data: audioBase64,
              },
            },
          ],
        },
      ],
    });

    const transcript = (response.text ?? "").trim();

    if (!transcript) {
      return NextResponse.json(
        { error: "Could not understand the audio. Please try speaking again." },
        { status: 422 }
      );
    }

    return NextResponse.json({ transcript });
  } catch (err: any) {
    console.error("Transcription error:", err);
    return NextResponse.json(
      { error: "Transcription failed. Please try again." },
      { status: 500 }
    );
  }
}
