// The Spider evaluation runner.
//
//   node src/eval/runSpider.js [--limit N] [--out DIR]
//
// One generation per database, no repair loop. Layer 0 is RECORDED under both
// grammars and does not gate: this experiment measures single-pass schema
// synthesis, and gating would confound it with repair. Specification item 3.
//
// Every generated schema is written to disk before anything is scored, so a
// scoring change never requires regeneration. That is deliberate the run costs
// ~25 minutes and the scorer is the part most likely to need a second pass.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { synthesiseSchema } from "../agents/schemaSynthesiser.js";
import { verifyGrammar } from "../agents/grammarVerifier.js";
import { parseSchema } from "../agents/relationalValidator.js";
import { readGeneratedSchema, goldSchema, scoreInstance } from "./schemaScorer.js";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
}

const limit = Number(arg("--limit", "0")) || Infinity;
const outDir = arg("--out", `${ROOT}tests/spider/run-${new Date().toISOString().slice(0, 10)}`);

mkdirSync(`${outDir}/generated`, { recursive: true });

const tables = JSON.parse(readFileSync(`${ROOT}tests/spider/tables.json`, "utf8"));
const { descriptions } = JSON.parse(readFileSync(`${ROOT}tests/spider/descriptions-100.json`, "utf8"));
const byId = new Map(tables.map((t) => [t.db_id, t]));

const results = [];
const started = performance.now();

for (const [index, item] of descriptions.slice(0, limit).entries()) {
  const gold = goldSchema(byId.get(item.db_id));

  const t0 = performance.now();
  let ddl = null;
  let error = null;
  try {
    ddl = await synthesiseSchema(item.description);
  } catch (err) {
    error = { type: err?.type ?? err?.name ?? "Error", message: err?.message ?? String(err) };
  }
  const latencyMs = Math.round(performance.now() - t0);

  const record = {
    db_id: item.db_id,
    fallbackDescription: item.fallback,
    latencyMs,
    chars: ddl?.length ?? null,
    error,
    gold: { tables: gold.tables.size, foreignKeys: gold.foreignKeys.length },
  };

  if (ddl !== null) {
    writeFileSync(`${outDir}/generated/${item.db_id}.sql`, ddl);

    const extended = verifyGrammar(ddl, { grammar: "extended" });
    const published = verifyGrammar(ddl, { grammar: "published" });
    record.layer0 = {
      extended: extended.passed ? { passed: true } : { passed: false, type: extended.error.type, line: extended.error.line },
      published: published.passed ? { passed: true } : { passed: false, type: published.error.type, line: published.error.line },
    };

    const generated = readGeneratedSchema(ddl);
    record.exact = scoreInstance(gold, generated, { matching: "exact" });
    record.normalised = scoreInstance(gold, generated, { matching: "normalised" });

    // Specification item 3: disagreements between Layer 0's structural map and
    // the lexical reader are counted rather than assumed absent.
    const lexical = parseSchema(ddl);
    record.readerDisagreement =
      extended.passed &&
      ([...extended.schema.keys()].sort().join() !== [...lexical.keys()].sort().join() ||
        [...lexical.keys()].some(
          (t) => [...(extended.schema.get(t) ?? [])].sort().join() !== [...lexical.get(t)].sort().join()
        ));
  }

  results.push(record);
  const v = record.layer0
    ? `L0 ${record.layer0.extended.passed ? "pass" : record.layer0.extended.type}`
    : "no output";
  const n = record.normalised;
  const f = (x) => (x === null || x === undefined ? " -- " : x.toFixed(2));
  console.log(
    `${String(index + 1).padStart(3)}/${Math.min(limit, descriptions.length)} ${item.db_id.padEnd(28)}` +
      `${String(latencyMs).padStart(6)}ms  ${v.padEnd(22)}` +
      (n ? ` tblP/R ${f(n.tables.precision)}/${f(n.tables.recall)}  colP/R ${f(n.columns.precision)}/${f(n.columns.recall)}` : "")
  );
}

// ---------------------------------------------------------------------------
// Aggregates — specification item 7: macro is the headline, micro alongside
// ---------------------------------------------------------------------------

function aggregate(matching) {
  const scored = results.filter((r) => r[matching]);
  const macro = {};
  const micro = {};
  for (const facet of ["tables", "columns", "foreignKeys"]) {
    for (const measure of ["precision", "recall"]) {
      const values = scored.map((r) => r[matching][facet][measure]).filter((v) => v !== null);
      macro[`${facet}.${measure}`] = values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null;
    }
    const matched = scored.reduce((a, r) => a + r[matching][facet].matched, 0);
    const generated = scored.reduce((a, r) => a + r[matching][facet].generated, 0);
    const gold = scored.reduce((a, r) => a + r[matching][facet].gold, 0);
    micro[`${facet}.precision`] = generated ? matched / generated : null;
    micro[`${facet}.recall`] = gold ? matched / gold : null;
  }
  const typeMatched = scored.reduce((a, r) => a + r[matching].types.matched, 0);
  const typeCorrect = scored.reduce((a, r) => a + r[matching].types.correct, 0);
  return { macro, micro, typeAccuracyMicro: typeMatched ? typeCorrect / typeMatched : null };
}

const summary = {
  model: "qwen2.5-coder:7b",
  temperature: 0,
  seed: 42,
  ranAt: new Date().toISOString(),
  instances: results.length,
  wallClockMs: Math.round(performance.now() - started),
  emptyOutput: results.filter((r) => !r.layer0).length,
  producedNoSchema: results.filter((r) => r.normalised?.empty).length,
  fallbackDescriptions: results.filter((r) => r.fallbackDescription).map((r) => r.db_id),
  layer0: {
    extendedAccepted: results.filter((r) => r.layer0?.extended.passed).length,
    publishedAccepted: results.filter((r) => r.layer0?.published.passed).length,
  },
  readerDisagreements: results.filter((r) => r.readerDisagreement).length,
  exact: aggregate("exact"),
  normalised: aggregate("normalised"),
};

writeFileSync(`${outDir}/results.json`, JSON.stringify({ summary, results }, null, 2));

const pct = (x) => (x === null ? "  --  " : (x * 100).toFixed(1).padStart(5) + "%");
console.log(`\n${"".padEnd(70, "-")}`);
console.log(`instances ${summary.instances}   wall clock ${(summary.wallClockMs / 60000).toFixed(1)} min`);
console.log(`Layer 0  extended ${summary.layer0.extendedAccepted}/${summary.instances}   published ${summary.layer0.publishedAccepted}/${summary.instances}`);
console.log(`reader disagreements ${summary.readerDisagreements}   produced no schema ${summary.producedNoSchema}`);
for (const matching of ["exact", "normalised"]) {
  const m = summary[matching].macro;
  console.log(
    `${matching.padEnd(11)} macro  tables P${pct(m["tables.precision"])} R${pct(m["tables.recall"])}` +
      `   columns P${pct(m["columns.precision"])} R${pct(m["columns.recall"])}` +
      `   FK P${pct(m["foreignKeys.precision"])} R${pct(m["foreignKeys.recall"])}`
  );
}
console.log(`type accuracy (micro, normalised) ${pct(summary.normalised.typeAccuracyMicro)}`);
console.log(`\nwritten to ${outDir}`);
