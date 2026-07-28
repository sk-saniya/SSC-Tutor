/**
 * Splits long text into overlapping word-based chunks so each chunk is
 * small enough to embed well and large enough to keep an idea intact.
 * Overlap means an idea that spans a chunk boundary still appears whole
 * in at least one chunk.
 */
export function chunkText(
  text: string,
  chunkSize = 350,
  overlap = 60
): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  if (words.length === 0) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    chunks.push(words.slice(start, end).join(" "));
    if (end === words.length) break;
    start = end - overlap;
  }

  return chunks.filter((c) => c.trim().length > 0);
}
