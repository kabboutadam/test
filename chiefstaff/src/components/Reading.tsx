import type { Reading as ReadingRow } from "@/core/sales";

/** The one line under a chart that says what it means. Tone has a word, not just a colour. */
export function Reading({ reading }: { reading: ReadingRow }) {
  const word = reading.tone === "bad" ? "Watch" : reading.tone === "good" ? "On track" : "Note";
  return (
    <p className={`reading reading-${reading.tone}`}>
      <span className="reading-word">{word}</span>
      {reading.text}
    </p>
  );
}
