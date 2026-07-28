import { SupabaseClient } from "@supabase/supabase-js";
import { embedText } from "@/lib/gemini";

export type RetrievedChunk = {
  id: string;
  content: string;
  similarity: number;
};

/**
 * The retrieval half of RAG: embed the student's question, ask Postgres
 * (via the match_chunks function from supabase/schema.sql) for the closest
 * chunks by cosine similarity, and return them ready to drop into a prompt.
 */
export async function retrieveRelevantChunks(
  supabase: SupabaseClient,
  question: string,
  matchCount = 5
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedText(question, "RETRIEVAL_QUERY");

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_count: matchCount,
  });

  if (error) {
    console.error("RAG retrieval failed:", error.message);
    return [];
  }

  return data ?? [];
}

export function chunksToContext(chunks: RetrievedChunk[]): string {
  return chunks
    .filter((c) => c.similarity > 0.55) // drop weak/irrelevant matches
    .map((c, i) => `[Source ${i + 1}]\n${c.content}`)
    .join("\n\n");
}
