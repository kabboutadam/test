import { Fragment, type ReactNode } from "react";

/**
 * Renders the narrow slice of markdown the brief prompt is allowed to emit:
 * h2, bullets, paragraphs, bold. Deliberately not a full parser — model output
 * goes through React nodes rather than dangerouslySetInnerHTML, so a prompt
 * injection in someone's email cannot become script in the executive's browser.
 */
function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyPrefix}-${index}`}>{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={`${keyPrefix}-${index}`}>{part}</Fragment>
    ),
  );
}

export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {bullets.map((item, index) => (
          <li key={index}>{inline(item, `li-${blocks.length}-${index}`)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const line of source.split("\n")) {
    const trimmed = line.trim();

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      bullets.push(trimmed.slice(2));
      continue;
    }
    flushBullets();

    if (!trimmed) continue;

    if (trimmed.startsWith("## ")) {
      blocks.push(<h2 key={`h-${blocks.length}`}>{inline(trimmed.slice(3), `h-${blocks.length}`)}</h2>);
    } else if (trimmed.startsWith("# ")) {
      blocks.push(<h2 key={`h-${blocks.length}`}>{inline(trimmed.slice(2), `h-${blocks.length}`)}</h2>);
    } else {
      blocks.push(<p key={`p-${blocks.length}`}>{inline(trimmed, `p-${blocks.length}`)}</p>);
    }
  }
  flushBullets();

  return <div className="brief-body">{blocks}</div>;
}
