// Scenario A, baseline arm: one monolithic call per database.
//
//   node src/eval/runMonolithic.js [--limit N] [--out DIR] [--resume]
//
// The pipeline arm of Scenario A is already on disk from the Spider run, so this
// produces the other half of the same comparison over identical inputs: the same
// descriptions, the same model, the same decoding settings, the same machine.
//
// A response that cannot be split into a schema and a module is COUNTED, never
// dropped. Single-call reliability is one of the things this arm measures, and
// an unsplittable response is a failure of it rather than a gap in the data.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { generateMonolithic, splitArtefacts } from "./monolithicBaseline.js";
import { verifyGrammar } from "../agents/grammarVerifier.js";
import { goldSchema, readGeneratedSchema, scoreInstance } from "./schemaScorer.js";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
}

const limit = Number(arg("--limit", "0")) || Infinity;
const resume = process.argv.includes("--resume");
const outDir = arg("--out", `${ROOT}tests/spider/monolithic-${new Date().toISOString().slice(0, 10)}`);

mkdirSync(`${outDir}/raw`, { recursive: true });
mkdirSync(`${outDir}/generated`, { recursive: true });

const tables = JSON.parse(readFileSync(`${ROOT}tests/spider/tables.json`, "utf8"));
const { descriptions } = JSON.parse(readFileSync(`${ROOT}tests/spider/descriptions-100.json`, "utf8"));
const byId = new Map(tables.map((t) => [t.db_id, t]));

const results = [];
const started = performance.now();

for (const [index, item] of descriptions.slice(0, limit).entries()) {
  const gold = goldSchema(byId.get(item.db_id));
  const rawPath = `${outDir}/raw/${item.db_id}.txt`;
  const reused = resume && existsSync(rawPath);

  const t0 = performance.now();
  let raw = null;
  let metrics = { promptTokens: null, evalTokens: null, totalDurationMs: null };
  let error = null;

  if (reused) {
    raw = readFileSync(rawPath, "utf8");
  } else {
    try {
      const response = await generateMonolithic(item.description);
      raw = response.response;
      metrics = response;
    } catch (err) {
      error = { type: err?.type ?? err?.name ?? "Error", message: err?.message ?? String(err) };
    }
  }
  const latencyMs = reused ? null : Math.round(performance.now() - t0);

  const record = {
    db_id: item.db_id,
    fallbackDescription: item.fallback,
    reused,
    latencyMs,
    rawChars: raw?.length ?? null,
    promptTokens: metrics.promptTokens,
    evalTokens: metrics.evalTokens,
    error,
    gold: { tables: gold.tables.size, foreignKeys: gold.foreignKeys.length },
  };

  if (raw !== null) {
    if (!reused) writeFileSync(rawPath, raw);

    const parts = splitArtefacts(raw);
    record.split = { ok: parts.split, reason: parts.reason, extraCodeBlocks: parts.extraCodeBlocks };

    if (parts.ddl !== null) {
      writeFileSync(`${outDir}/generated/${item.db_id}.sql`, parts.ddl);
      const extended = verifyGrammar(parts.ddl, { grammar: "extended" });
      const published = verifyGrammar(parts.ddl, { grammar: "published" });
      record.layer0 = {
        extended: extended.passed ? { passed: true } : { passed: false, type: extended.error.type, line: extended.error.line },
        published: published.passed ? { passed: true } : { passed: false, type: published.error.type, line: published.error.line },
      };

      const generated = readGeneratedSchema(parts.ddl);
      record.exact = scoreInstance(gold, generated, { matching: "exact" });
      record.normalised = scoreInstance(gold, generated, { matching: "normalised" });
    }
    if (parts.code !== null) writeFileSync(`${outDir}/generated/${item.db_id}.js.txt`, parts.code);
  }

  results.push(record);
  const n = record.normalised;
  const f = (x) => (x === null || x === undefined ? " -- " : x.toFixed(2));
  console.log(
    `${String(index + 1).padStart(3)}/${Math.min(limit, descriptions.length)} ${item.db_id.padEnd(28)}` +
      `${(reused ? "reused" : `${latencyMs}ms`).padStart(8)}  ` +
      // Three outcomes, never conflated: the call failed, the response could
      // not be split, or it split. An infrastructure failure is not a defect in
      // the model's output and must not be counted as one.
      `${(raw === null ? "NO RESPONSE" : record.split?.ok ? "split" : "SPLIT FAIL").padEnd(12)}` +
      (n ? ` tblP/R ${f(n.tables.precision)}/${f(n.tables.recall)}  colP/R ${f(n.columns.precision)}/${f(n.columns.recall)}` : "")
  );
}

function aggregate(matching) {
  const scored = results.filter((r) => r[matching]);
  const macro = {};
  for (const facet of ["tables", "columns", "foreignKeys"]) {
    for (const measure of ["precision", "recall"]) {
      const values = scored.map((r) => r[matching][facet][measure]).filter((v) => v !== null);
      macro[`${facet}.${measure}`] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    }
  }
  const typeMatched = scored.reduce((a, r) => a + r[matching].types.matched, 0);
  const typeCorrect = scored.reduce((a, r) => a + r[matching].types.correct, 0);
  return { macro, scoredInstances: scored.length, typeAccuracyMicro: typeMatched ? typeCorrect / typeMatched : null };
}

const generatedRecords = results.filter((r) => !r.reused && r.latencyMs !== null);
const summary = {
  arm: "monolithic",
  model: "qwen2.5-coder:7b",
  temperature: 0,
  seed: 42,
  ranAt: new Date().toISOString(),
  instances: results.length,
  generated: generatedRecords.length,
  reused: results.filter((r) => r.reused).length,
  wallClockMs: Math.round(performance.now() - started),
  meanLatencyMs: generatedRecords.length
    ? Math.round(generatedRecords.reduce((a, r) => a + r.latencyMs, 0) / generatedRecords.length)
    : null,
  // Split failures are first-class: counted, and broken down by reason.
  splitFailures: results.filter((r) => r.split && !r.split.ok).length,
  splitFailureReasons: results
    .filter((r) => r.split && !r.split.ok)
    .reduce((acc, r) => ({ ...acc, [r.split.reason]: (acc[r.split.reason] ?? 0) + 1 }), {}),
  instancesWithExtraCodeBlocks: results.filter((r) => r.split?.extraCodeBlocks > 0).length,
  // Infrastructure failures are reported separately from split failures. One
  // says the endpoint did not answer; the other says the model answered with
  // something unusable. Merging them would corrupt the reliability figure this
  // arm is meant to produce. Re-running with --resume retries only these,
  // because every successful response is already on disk.
  noResponse: results.filter((r) => r.rawChars === null).length,
  noResponseInstances: results.filter((r) => r.rawChars === null).map((r) => ({ db_id: r.db_id, error: r.error })),
  tokens: {
    prompt: results.reduce((a, r) => a + (r.promptTokens ?? 0), 0),
    completion: results.reduce((a, r) => a + (r.evalTokens ?? 0), 0),
  },
  layer0: {
    extendedAccepted: results.filter((r) => r.layer0?.extended.passed).length,
    publishedAccepted: results.filter((r) => r.layer0?.published.passed).length,
  },
  exact: aggregate("exact"),
  normalised: aggregate("normalised"),
};

const resultsPath = `${outDir}/results.json`;
let target = resultsPath;
if (existsSync(resultsPath)) {
  const existing = JSON.parse(readFileSync(resultsPath, "utf8"));
  if ((existing.summary?.instances ?? 0) > results.length) {
    target = `${outDir}/results-partial-${results.length}.json`;
    console.log(`\n! ${resultsPath} holds ${existing.summary.instances} instances; writing to ${target}`);
  }
}
writeFileSync(target, JSON.stringify({ summary, results }, null, 2));

const pct = (x) => (x === null ? "  --  " : (x * 100).toFixed(1).padStart(5) + "%");
console.log(`\n${"".padEnd(70, "-")}`);
console.log(`instances ${summary.instances}   generated ${summary.generated}   wall clock ${(summary.wallClockMs / 60000).toFixed(1)} min`);
console.log(`split failures ${summary.splitFailures}   extra code blocks ${summary.instancesWithExtraCodeBlocks}   no response (infrastructure) ${summary.noResponse}`);
console.log(`Layer 0  extended ${summary.layer0.extendedAccepted}/${summary.instances}   published ${summary.layer0.publishedAccepted}/${summary.instances}`);
console.log(`tokens  prompt ${summary.tokens.prompt}  completion ${summary.tokens.completion}`);
for (const matching of ["exact", "normalised"]) {
  const m = summary[matching].macro;
  console.log(
    `${matching.padEnd(11)} macro  tables P${pct(m["tables.precision"])} R${pct(m["tables.recall"])}` +
      `   columns P${pct(m["columns.precision"])} R${pct(m["columns.recall"])}` +
      `   FK P${pct(m["foreignKeys.precision"])} R${pct(m["foreignKeys.recall"])}`
  );
}
console.log(`\nwritten to ${outDir}`);
