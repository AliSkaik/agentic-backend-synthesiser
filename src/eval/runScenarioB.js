// Scenario B: full backend, two feature descriptions, three arms.
//
//   node src/eval/runScenarioB.js [--out DIR]
//
// n = 2. Every figure this produces describes two runs and is illustrative, not
// evidential. Scenario A is where the sample size lives.
//
// THREE ARMS, because two would fuse two different claims into one:
//
//   baseline            one monolithic call, one verdict
//   pipeline attempt 1  the first schema and the first module, before any
//                       feedback. The like-for-like arm.
//   pipeline final      after both bounded loops converge or exhaust
//
// baseline vs attempt 1 asks whether staged prompting helps.
// attempt 1 vs final asks whether the loop helps. They are separate questions.
//
// Attempt 1 is READ OUT OF THE TRANSCRIPT rather than generated separately.
// Generation is deterministic at temperature 0 with a fixed seed, so the first
// attempt inside the loop is byte-identical to a standalone single-shot run.
// That is exact, not an approximation, and it removes one generation per fixture.
//
// Layer verdicts are reported per arm and carry NO cross-arm claim: the baseline
// reaches the verifier through the splitter, the pipeline does not, and Scenario
// A showed that comparing across that difference measures the delimiter. The
// symmetric measure is `extractionRequired`, computed by one function on both.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { generateMonolithic, splitArtefacts } from "./monolithicBaseline.js";
import { synthesiseVerifiedSchema } from "../synthesise.js";
import { reflect } from "../reflect.js";
import { verifyGrammar } from "../agents/grammarVerifier.js";
import { verify } from "../verify.js";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const outDir = arg("--out", `${ROOT}tests/scenario-b-${new Date().toISOString().slice(0, 10)}`);
mkdirSync(outDir, { recursive: true });

const FIXTURES = [
  {
    id: "blog",
    description: "A blog with users, posts and tags. Posts belong to a user and can have many tags.",
  },
  {
    id: "orders",
    description: "An online shop with customers, orders and the line items on each order.",
  },
];

// The symmetric measure: did the arm emit content that had to be removed before
// the module could be parsed? One function, both arms, no delimiter advantage.
function extractionRequired(raw) {
  const parts = splitArtefacts(raw);
  const kept = (parts.ddl?.length ?? 0) + (parts.code?.length ?? 0);
  return { removedChars: Math.max(raw.length - kept, 0), fraction: raw.length ? 1 - kept / raw.length : null };
}

const results = [];

for (const fixture of FIXTURES) {
  console.log(`\n=== ${fixture.id} ===`);
  const record = { id: fixture.id, description: fixture.description };

  // --- baseline ---------------------------------------------------------
  const b0 = performance.now();
  let baseline = null;
  try {
    const response = await generateMonolithic(fixture.description);
    const parts = splitArtefacts(response.response);
    const layer0 = parts.ddl ? verifyGrammar(parts.ddl, { grammar: "extended" }) : null;
    const layers12 = parts.ddl && parts.code ? verify(parts.code, parts.ddl) : null;
    baseline = {
      latencyMs: Math.round(performance.now() - b0),
      promptTokens: response.promptTokens,
      evalTokens: response.evalTokens,
      split: parts.split,
      splitReason: parts.reason,
      extraction: extractionRequired(response.response),
      layer0: layer0 ? { passed: layer0.passed, type: layer0.error?.type ?? null } : null,
      verified: layers12?.verified ?? false,
      failedLayer: layers12?.layer ?? null,
      errorType: layers12?.error?.type ?? null,
    };
    writeFileSync(`${outDir}/${fixture.id}.baseline.raw.txt`, response.response);
    if (parts.ddl) writeFileSync(`${outDir}/${fixture.id}.baseline.sql`, parts.ddl);
    if (parts.code) writeFileSync(`${outDir}/${fixture.id}.baseline.js.txt`, parts.code);
  } catch (err) {
    baseline = { error: { type: err?.type ?? err?.name ?? "Error", message: err?.message ?? String(err) } };
  }
  record.baseline = baseline;
  console.log(
    `baseline        ${baseline.error ? "NO RESPONSE" : `${baseline.latencyMs}ms  split=${baseline.split}  L0=${baseline.layer0?.passed}  verified=${baseline.verified}`}`
  );

  // --- pipeline ---------------------------------------------------------
  const p0 = performance.now();
  const schema = await synthesiseVerifiedSchema(fixture.description);
  record.pipeline = { schema: { outcome: schema.outcome, attempts: schema.attempts } };
  console.log(
    `Agent 1 loop    ${schema.outcome} after ${schema.attempts.length} attempt(s), Layer 0 first verdict: ${schema.attempts[0].verified ? "pass" : schema.attempts[0].errorType}`
  );

  if (schema.verified) {
    const routes = await reflect(schema.ddl);
    record.pipeline.routes = { outcome: routes.outcome, attempts: routes.attempts };
    record.pipeline.totalLatencyMs = Math.round(performance.now() - p0);
    writeFileSync(`${outDir}/${fixture.id}.pipeline.sql`, schema.ddl);
    if (routes.code) writeFileSync(`${outDir}/${fixture.id}.pipeline.js.txt`, routes.code);
    console.log(
      `Agent 2 loop    ${routes.outcome} after ${routes.attempts.length} attempt(s), first verdict: ${routes.attempts[0].verified ? "verified" : "fail layer " + routes.attempts[0].failedLayer}`
    );
  } else {
    record.pipeline.totalLatencyMs = Math.round(performance.now() - p0);
    console.log("Agent 2 loop    not entered; the schema never converged");
  }

  results.push(record);
}

writeFileSync(`${outDir}/results.json`, JSON.stringify({ n: FIXTURES.length, ranAt: new Date().toISOString(), results }, null, 2));

// --- the three-row table, with n in the caption -------------------------
console.log(`\n${"".padEnd(78, "-")}`);
console.log("Scenario B, n = 2 fixtures. Illustrative, not evidential.\n");
for (const r of results) {
  const a1s = r.pipeline.schema.attempts[0];
  const a1r = r.pipeline.routes?.attempts[0];
  console.log(`${r.id}`);
  console.log(`  baseline            L0 ${r.baseline.layer0?.passed ? "pass" : r.baseline.layer0?.type}   verified ${r.baseline.verified}   ${r.baseline.latencyMs}ms`);
  console.log(`  pipeline attempt 1  L0 ${a1s.verified ? "pass" : a1s.errorType}   ${a1r ? `L1/L2 ${a1r.verified ? "verified" : "fail layer " + a1r.failedLayer}` : "routes not reached"}`);
  console.log(`  pipeline final      schema ${r.pipeline.schema.outcome} (${r.pipeline.schema.attempts.length} attempts)   routes ${r.pipeline.routes?.outcome ?? "n/a"} (${r.pipeline.routes?.attempts.length ?? 0} attempts)   ${r.pipeline.totalLatencyMs}ms`);
  console.log(`  extraction removed  baseline ${(r.baseline.extraction?.fraction * 100 ?? 0).toFixed(1)}% of its response`);
}
console.log(`\nwritten to ${outDir}`);
