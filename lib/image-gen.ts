// Pollinations.ai is a free, keyless text-to-image endpoint — a GET request
// to this URL returns a generated image directly, no signup required.
// Good fit for "draw me a diagram of X" answers where exact photographic
// accuracy doesn't matter as much as having a helpful visual.
export function buildDiagramImageUrl(prompt: string): string {
  // Adding explicit instructions to the prompt to help generate better labels
  const safePrompt = `simple labeled educational diagram, textbook illustration style, large clear readable English text labels, ${prompt}`;
  const encoded = encodeURIComponent(safePrompt);
  const seed = Math.floor(Math.random() * 100000);
  return `https://image.pollinations.ai/prompt/${encoded}?width=768&height=768&seed=${seed}&nologo=true`;
}
