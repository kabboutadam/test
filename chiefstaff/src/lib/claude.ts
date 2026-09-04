import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { z } from "zod";
import { env } from "./env";

export const MODEL = "claude-opus-5";

/** USD per million tokens for MODEL. Update alongside the model. */
const PRICING = {
  input: 5,
  output: 25,
  cacheWrite: 6.25,
  cacheRead: 0.5,
};

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

export interface Usage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  usd: number;
}

export const NO_USAGE: Usage = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, usd: 0 };

function accountFor(usage: Anthropic.Usage): Usage {
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;

  return {
    input,
    output,
    cacheWrite,
    cacheRead,
    usd:
      (input * PRICING.input +
        output * PRICING.output +
        cacheWrite * PRICING.cacheWrite +
        cacheRead * PRICING.cacheRead) /
      1_000_000,
  };
}

export function sumUsage(entries: Usage[]): Usage {
  return entries.reduce(
    (total, entry) => ({
      input: total.input + entry.input,
      output: total.output + entry.output,
      cacheWrite: total.cacheWrite + entry.cacheWrite,
      cacheRead: total.cacheRead + entry.cacheRead,
      usd: total.usd + entry.usd,
    }),
    NO_USAGE,
  );
}

/**
 * JSON Schema keywords the structured-outputs API rejects. Everything else
 * zod emits is passed through — notably `enum` and `const`, which the API
 * supports and which the SDK's own zodOutputFormat (0.123) demotes into a
 * description string, leaving the server free to return any value at all.
 * That is how a triage run died on an off-enum category.
 */
const UNSUPPORTED_KEYWORDS = new Set([
  "$schema",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "maxItems",
  "uniqueItems",
]);

function stripUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupported);
  if (typeof node !== "object" || node === null) return node;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (UNSUPPORTED_KEYWORDS.has(key)) continue;
    // The API accepts minItems of 0 or 1 only.
    if (key === "minItems" && value !== 0 && value !== 1) continue;
    out[key] = stripUnsupported(value);
  }
  return out;
}

/** A zod schema as the API wants it: enums intact, unsupported constraints gone. */
export function apiSchema(schema: z.ZodType): { type: "object"; [key: string]: unknown } {
  const json = stripUnsupported(z.toJSONSchema(schema, { reused: "ref" })) as Record<string, unknown>;
  if (json.type !== "object") throw new Error("Structured output schema must be an object at the root");
  return json as { type: "object"; [key: string]: unknown };
}

class SchemaViolation extends Error {
  constructor(public readonly issues: string) {
    super(`Model output failed schema validation: ${issues}`);
  }
}

export interface ExtractOptions<T extends z.ZodType> {
  schema: T;
  system: string;
  prompt: string;
  /** Reference material, appended after the cached system block. */
  context?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
}

/**
 * One structured call to Claude. Everything the pipeline asks for is a schema,
 * never free text we then have to parse — a triage pass that returns prose is a
 * triage pass that silently breaks the inbox.
 *
 * Returns usage alongside the value so callers (notably the eval harness) can
 * report what a run cost without threading a meter through every layer.
 */
export async function extractWithUsage<T extends z.ZodType>(
  opts: ExtractOptions<T>,
): Promise<{ value: z.infer<T>; usage: Usage }> {
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: opts.system, cache_control: { type: "ephemeral" } },
  ];
  if (opts.context) system.push({ type: "text", text: opts.context });

  const format = jsonSchemaOutputFormat(apiSchema(opts.schema), { transform: false });
  const usages: Usage[] = [];

  // One retry, for schema violations only. The server now enforces the
  // schema, so this should be rare — but a triage that dies on one bad field
  // is a missed morning, and a second attempt is cheap insurance.
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await anthropic().messages.parse({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: opts.effort ?? "medium", format },
      system,
      messages: [{ role: "user", content: opts.prompt }],
    });
    usages.push(accountFor(response.usage));

    if (response.stop_reason === "refusal") {
      throw new Error(`Claude declined: ${response.stop_details?.explanation ?? "no reason given"}`);
    }
    if (response.parsed_output == null) {
      throw new Error("Claude returned no parseable output");
    }

    // The SDK only JSON.parsed it; zod is what checks it against the schema.
    const checked = opts.schema.safeParse(response.parsed_output);
    if (checked.success) {
      return { value: checked.data as z.infer<T>, usage: sumUsage(usages) };
    }

    const issues = checked.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    if (attempt === 1) throw new SchemaViolation(issues);
    console.warn(`structured output failed validation, retrying once: ${issues}`);
  }

  throw new Error("unreachable");
}

export async function extract<T extends z.ZodType>(opts: ExtractOptions<T>): Promise<z.infer<T>> {
  return (await extractWithUsage(opts)).value;
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
