/**
 * Triage eval. Runs the classifier over a labelled corpus and scores it.
 *
 *   npm run eval                 one pass, batches of 16
 *   npm run eval -- --runs 3     three passes; reports spread as well as mean
 *   npm run eval -- --effort high
 *   npm run eval -- --batch 8
 *
 * Precision is the headline number. A decision inbox that surfaces noise gets
 * skimmed and then ignored, and an ignored inbox is a dead product. But every
 * miss is printed in full, because one missed escalation costs more than a
 * month of small false positives.
 */
import { buildPrompt, classify, TRIAGE_SYSTEM, type TriagedItem } from "../src/core/triage";
import { sumUsage, type Usage } from "../src/lib/claude";
import { CASES, EVAL_EXEC, EVAL_NOW, type EvalCase } from "./cases";

/** Ship gates. Below either of these, a prompt change is a regression. */
const MIN_PRECISION = 0.8;
const MIN_RECALL = 0.85;

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

interface Options {
  runs: number;
  batch: number;
  effort: Effort;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { runs: 1, batch: 16, effort: "medium", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i + 1];
    if (argv[i] === "--runs" && value) options.runs = Math.max(1, Number(value));
    if (argv[i] === "--batch" && value) options.batch = Math.max(1, Number(value));
    if (argv[i] === "--effort" && value) options.effort = value as Effort;
    if (argv[i] === "--dry-run") options.dryRun = true;
  }
  return options;
}

interface Judged {
  testCase: EvalCase;
  verdict: TriagedItem | null;
}

interface RunScore {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  precision: number;
  recall: number;
  f1: number;
  categoryHits: number;
  categoryScored: number;
  urgencyError: number;
  urgencyScored: number;
  missing: number;
  /** Batches whose response failed schema validation. Any is a gate failure. */
  batchFailures: number;
  usage: Usage;
  judged: Judged[];
}

/**
 * Deterministic shuffle. The corpus is written grouped by label, and feeding
 * the model a batch of twelve escalations followed by a batch of pure noise
 * measures something other than triage. Seeded so runs stay comparable.
 */
function shuffled<T>(items: T[], seed = 20260310): T[] {
  const out = [...items];
  let state = seed;
  for (let i = out.length - 1; i > 0; i--) {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Split the corpus into batches, keeping linked cases (same `group`) in one
 * batch and in their written order. Some labels are only right because the
 * model can see a later signal in the same batch — an ask that was retracted
 * two hours on — and splitting the pair turns a batching test into noise.
 */
function batches(cases: EvalCase[], size: number): EvalCase[][] {
  const groups: EvalCase[][] = [];
  const byKey = new Map<string, EvalCase[]>();
  for (const testCase of cases) {
    if (!testCase.group) {
      groups.push([testCase]);
      continue;
    }
    let group = byKey.get(testCase.group);
    if (!group) {
      group = [];
      byKey.set(testCase.group, group);
      groups.push(group);
    }
    group.push(testCase);
  }

  const out: EvalCase[][] = [];
  let current: EvalCase[] = [];
  for (const group of shuffled(groups)) {
    if (current.length > 0 && current.length + group.length > size) {
      out.push(current);
      current = [];
    }
    current.push(...group);
  }
  if (current.length) out.push(current);
  return out;
}

async function runOnce(options: Options): Promise<RunScore> {
  const judged: Judged[] = [];
  const usages: Usage[] = [];
  let batchFailures = 0;

  for (const batch of batches(CASES, options.batch)) {
    let items: TriagedItem[];
    try {
      const result = await classify(
        EVAL_EXEC,
        batch.map((testCase) => testCase.signal),
        { now: EVAL_NOW, effort: options.effort },
      );
      items = result.items;
      usages.push(result.usage);
    } catch (error) {
      // A batch that fails to parse is a real finding, not a reason to lose
      // the rest of the run: every case in it counts as unreturned.
      batchFailures++;
      console.error(`  batch failed (${batch.length} cases): ${error instanceof Error ? error.message.split("\n")[0] : error}`);
      for (const testCase of batch) judged.push({ testCase, verdict: null });
      continue;
    }

    // The model returns signal_index; anything it skipped counts as a miss
    // rather than silently vanishing from the denominator.
    const byIndex = new Map<number, TriagedItem>();
    for (const item of items) if (!byIndex.has(item.signal_index)) byIndex.set(item.signal_index, item);

    batch.forEach((testCase, index) => {
      judged.push({ testCase, verdict: byIndex.get(index) ?? null });
    });
  }

  const score: RunScore = {
    truePositives: 0,
    falsePositives: 0,
    falseNegatives: 0,
    trueNegatives: 0,
    precision: 0,
    recall: 0,
    f1: 0,
    categoryHits: 0,
    categoryScored: 0,
    urgencyError: 0,
    urgencyScored: 0,
    missing: 0,
    batchFailures,
    usage: sumUsage(usages),
    judged,
  };

  for (const { testCase, verdict } of judged) {
    if (!verdict) score.missing++;
    const surfaced = verdict?.needs_executive ?? false;
    const expected = testCase.expect.surface;

    if (expected && surfaced) score.truePositives++;
    else if (!expected && surfaced) score.falsePositives++;
    else if (expected && !surfaced) score.falseNegatives++;
    else score.trueNegatives++;

    // Category and urgency are only meaningful when the model agreed it belongs.
    if (expected && surfaced && verdict) {
      if (testCase.expect.category) {
        score.categoryScored++;
        if (verdict.category === testCase.expect.category) score.categoryHits++;
      }
      if (testCase.expect.urgency !== undefined) {
        score.urgencyScored++;
        score.urgencyError += Math.abs(verdict.urgency - testCase.expect.urgency);
      }
    }
  }

  const predicted = score.truePositives + score.falsePositives;
  const actual = score.truePositives + score.falseNegatives;
  score.precision = predicted === 0 ? 0 : score.truePositives / predicted;
  score.recall = actual === 0 ? 0 : score.truePositives / actual;
  score.f1 =
    score.precision + score.recall === 0
      ? 0
      : (2 * score.precision * score.recall) / (score.precision + score.recall);

  return score;
}

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

function reportMisses(score: RunScore): void {
  const falseNegatives = score.judged.filter(
    ({ testCase, verdict }) => testCase.expect.surface && !(verdict?.needs_executive ?? false),
  );
  const falsePositives = score.judged.filter(
    ({ testCase, verdict }) => !testCase.expect.surface && (verdict?.needs_executive ?? false),
  );

  if (falseNegatives.length) {
    console.log(`\nMISSED — should have surfaced (${falseNegatives.length}):`);
    for (const { testCase, verdict } of falseNegatives) {
      console.log(`  ✗ ${testCase.id}`);
      console.log(`      why it matters: ${testCase.note}`);
      console.log(`      model said:     ${verdict ? verdict.why : "(no verdict returned)"}`);
    }
  }

  if (falsePositives.length) {
    console.log(`\nNOISE — should not have surfaced (${falsePositives.length}):`);
    for (const { testCase, verdict } of falsePositives) {
      console.log(`  ✗ ${testCase.id}`);
      console.log(`      why it is noise: ${testCase.note}`);
      console.log(`      model said:      ${verdict?.why ?? ""}`);
    }
  }

  const wrongCategory = score.judged.filter(
    ({ testCase, verdict }) =>
      testCase.expect.surface &&
      verdict?.needs_executive &&
      testCase.expect.category &&
      verdict.category !== testCase.expect.category,
  );
  if (wrongCategory.length) {
    console.log(`\nWRONG CATEGORY (${wrongCategory.length}):`);
    for (const { testCase, verdict } of wrongCategory) {
      console.log(`  · ${testCase.id}: expected ${testCase.expect.category}, got ${verdict!.category}`);
    }
  }

  const wrongUrgency = score.judged.filter(
    ({ testCase, verdict }) =>
      testCase.expect.surface &&
      verdict?.needs_executive &&
      testCase.expect.urgency !== undefined &&
      Math.abs(verdict.urgency - testCase.expect.urgency) >= 2,
  );
  if (wrongUrgency.length) {
    console.log(`\nURGENCY OFF BY 2+ (${wrongUrgency.length}):`);
    for (const { testCase, verdict } of wrongUrgency) {
      console.log(`  · ${testCase.id}: expected ${testCase.expect.urgency}, got ${verdict!.urgency}`);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const positives = CASES.filter((testCase) => testCase.expect.surface).length;

  console.log(
    `Triage eval · ${CASES.length} cases (${positives} should surface, ${CASES.length - positives} should not)`,
  );
  console.log(`Batches of ${options.batch} · effort ${options.effort} · ${options.runs} run(s)\n`);

  if (options.dryRun) {
    // Everything up to the API boundary: label balance, batching, and the
    // exact prompt. Useful for reviewing a prompt change before paying for it.
    const split = batches(CASES, options.batch);
    console.log(
      `${split.length} batch(es): ${split
        .map((batch) => `${batch.length} cases / ${batch.filter((testCase) => testCase.expect.surface).length} positive`)
        .join(", ")}`,
    );

    const categories = new Map<string, number>();
    for (const testCase of CASES) {
      if (!testCase.expect.surface) continue;
      const key = testCase.expect.category ?? "unspecified";
      categories.set(key, (categories.get(key) ?? 0) + 1);
    }
    console.log(`positives by category: ${[...categories].map(([key, n]) => `${key} ${n}`).join(", ")}`);
    split.forEach((batch, index) => {
      console.log(`  batch ${index + 1}: ${batch.map((testCase) => testCase.id + (testCase.group ? `[${testCase.group}]` : "")).join(", ")}`);
    });

    const duplicates = CASES.map((testCase) => testCase.id).filter(
      (id, index, all) => all.indexOf(id) !== index,
    );
    if (duplicates.length) console.log(`DUPLICATE IDS: ${duplicates.join(", ")}`);

    const prompt = buildPrompt(EVAL_EXEC, split[0].map((testCase) => testCase.signal), EVAL_NOW);
    console.log(`\nsystem prompt: ${TRIAGE_SYSTEM.length} chars`);
    console.log(`batch 1 prompt: ${prompt.length} chars\n`);
    console.log(prompt.slice(0, 1200) + "\n[...]");
    return;
  }

  const scores: RunScore[] = [];
  for (let run = 1; run <= options.runs; run++) {
    const score = await runOnce(options);
    scores.push(score);

    console.log(
      `run ${run}: precision ${pct(score.precision)}  recall ${pct(score.recall)}  F1 ${pct(score.f1)}` +
        `  (${score.truePositives} hit, ${score.falsePositives} noise, ${score.falseNegatives} missed)` +
        `  $${score.usage.usd.toFixed(3)}`,
    );
  }

  const mean = (pick: (score: RunScore) => number) =>
    scores.reduce((total, score) => total + pick(score), 0) / scores.length;

  const last = scores[scores.length - 1];
  console.log("\n" + "─".repeat(64));
  console.log(`precision      ${pct(mean((s) => s.precision))}   (gate ${pct(MIN_PRECISION)})`);
  console.log(`recall         ${pct(mean((s) => s.recall))}   (gate ${pct(MIN_RECALL)})`);
  console.log(`F1             ${pct(mean((s) => s.f1))}`);

  if (last.categoryScored) {
    console.log(`category       ${pct(mean((s) => (s.categoryScored ? s.categoryHits / s.categoryScored : 0)))}`);
  }
  if (last.urgencyScored) {
    console.log(
      `urgency MAE    ${mean((s) => (s.urgencyScored ? s.urgencyError / s.urgencyScored : 0)).toFixed(2)} levels`,
    );
  }
  if (scores.some((score) => score.missing)) {
    console.log(`unreturned     ${mean((s) => s.missing).toFixed(1)} signals (model skipped these)`);
  }
  const failedBatches = scores.reduce((total, score) => total + score.batchFailures, 0);
  if (failedBatches) {
    console.log(`batch failures ${failedBatches} across ${scores.length} run(s) — responses that failed the schema`);
  }

  const totalUsage = sumUsage(scores.map((score) => score.usage));
  console.log(
    `cost           $${(totalUsage.usd / scores.length).toFixed(3)} per run  ` +
      `(${Math.round(totalUsage.input / scores.length)} in / ${Math.round(totalUsage.output / scores.length)} out, ` +
      `${Math.round(totalUsage.cacheRead / scores.length)} cached)`,
  );

  if (options.runs > 1) {
    const spread = (pick: (score: RunScore) => number) => {
      const values = scores.map(pick);
      return `${pct(Math.min(...values))}–${pct(Math.max(...values))}`;
    };
    console.log(`\nspread across runs: precision ${spread((s) => s.precision)}, recall ${spread((s) => s.recall)}`);
  }

  // Misses from the final run, so the printed detail matches a real pass.
  reportMisses(last);

  const meanPrecision = mean((score) => score.precision);
  const meanRecall = mean((score) => score.recall);
  if (meanPrecision < MIN_PRECISION || meanRecall < MIN_RECALL || failedBatches > 0) {
    console.log(failedBatches ? `\nFAILED — a batch failed schema validation; in production that is a missed morning.` : `\nFAILED — below gate.`);
    process.exit(1);
  }
  console.log(`\nPASSED`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
