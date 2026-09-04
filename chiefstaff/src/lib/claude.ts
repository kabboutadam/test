import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { env } from "./env";

export const MODEL = "claude-opus-5";

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

/**
 * One structured call to Claude. Everything the pipeline asks for is a schema,
 * never free text we then have to parse — a triage pass that returns prose is a
 * triage pass that silently breaks the inbox.
 */
export async function extract<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  prompt: string;
  /** Reference material, cached across calls that share a prefix. */
  context?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: opts.system, cache_control: { type: "ephemeral" } },
  ];
  if (opts.context) system.push({ type: "text", text: opts.context });

  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: opts.effort ?? "medium",
      format: zodOutputFormat(opts.schema),
    },
    system,
    messages: [{ role: "user", content: opts.prompt }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(`Claude declined: ${response.stop_details?.explanation ?? "no reason given"}`);
  }
  if (!response.parsed_output) {
    throw new Error("Claude returned no parseable output");
  }
  return response.parsed_output as z.infer<T>;
}

/** Free-text generation, for the brief itself, which is prose by design. */
export async function write(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  const response = await anthropic().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opts.prompt }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(`Claude declined: ${response.stop_details?.explanation ?? "no reason given"}`);
  }
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
