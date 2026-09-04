/**
 * The narrow slice of markdown the brief prompt is allowed to emit: h2,
 * bullets, paragraphs, bold. Parsed once here so the web view and the email
 * render the same brief — two parsers means two behaviours, and the one nobody
 * looks at is the one that breaks.
 *
 * Deliberately not a general markdown parser. Brief text is model output
 * derived from other people's email, so it is treated as data throughout:
 * consumers render structured nodes, never raw HTML.
 */

export type Span = { bold: boolean; text: string };

export type Block =
  | { type: "heading"; spans: Span[] }
  | { type: "paragraph"; spans: Span[] }
  | { type: "list"; items: Span[][] };

function spansOf(text: string): Span[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((part) => part !== "")
    .map((part) =>
      part.startsWith("**") && part.endsWith("**")
        ? { bold: true, text: part.slice(2, -2) }
        : { bold: false, text: part },
    );
}

export function parseBrief(source: string): Block[] {
  const blocks: Block[] = [];
  let bullets: Span[][] = [];

  const flush = () => {
    if (bullets.length === 0) return;
    blocks.push({ type: "list", items: bullets });
    bullets = [];
  };

  for (const line of source.split("\n")) {
    const trimmed = line.trim();

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      bullets.push(spansOf(trimmed.slice(2)));
      continue;
    }
    flush();

    if (!trimmed) continue;

    const heading = /^#{1,3}\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push({ type: "heading", spans: spansOf(heading[1]) });
    } else {
      blocks.push({ type: "paragraph", spans: spansOf(trimmed) });
    }
  }
  flush();

  return blocks;
}

/** Plain-text rendering, for the text/plain half of the email. */
export function briefToText(source: string): string {
  return parseBrief(source)
    .map((block) => {
      const flatten = (spans: Span[]) => spans.map((span) => span.text).join("");
      if (block.type === "heading") return flatten(block.spans).toUpperCase();
      if (block.type === "list") return block.items.map((item) => `  - ${flatten(item)}`).join("\n");
      return flatten(block.spans);
    })
    .join("\n\n");
}
