import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { extractTextFromFile, ingestDocument } from "@/lib/rag/ingest";

// This route writes to the shared knowledge base, so it's gated behind a
// secret instead of a regular student login. Set ADMIN_INGEST_SECRET in
// .env.local and send it as the "x-admin-secret" header when you call this
// (see README.md for a ready-to-use curl example).
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_INGEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const title = formData.get("title") as string | null;
  const subject = formData.get("subject") as string | null;
  const chapter = (formData.get("chapter") as string | null) ?? undefined;

  if (!file || !title || (subject !== "science" && subject !== "math")) {
    return NextResponse.json(
      { error: "Required: file, title, and subject ('science' or 'math')" },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractTextFromFile(buffer, file.type);

    if (!text.trim()) {
      return NextResponse.json(
        { error: "No extractable text found in that file" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceClient();
    const result = await ingestDocument(supabase, {
      title,
      subject,
      chapter,
      text,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("Ingestion failed:", err);
    return NextResponse.json({ error: "Ingestion failed" }, { status: 500 });
  }
}
