import { Fragment } from "react";
import { parseBrief, type Span } from "./brief-blocks";

/**
 * Renders a brief for the web. Model output goes through React nodes rather
 * than dangerouslySetInnerHTML, so a prompt injection sitting in someone's
 * email cannot become script in the executive's browser.
 */
function Spans({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((span, index) =>
        span.bold ? <strong key={index}>{span.text}</strong> : <Fragment key={index}>{span.text}</Fragment>,
      )}
    </>
  );
}

export function Markdown({ source }: { source: string }) {
  return (
    <div className="brief-body">
      {parseBrief(source).map((block, index) => {
        if (block.type === "heading") {
          return (
            <h2 key={index}>
              <Spans spans={block.spans} />
            </h2>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Spans spans={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index}>
            <Spans spans={block.spans} />
          </p>
        );
      })}
    </div>
  );
}
