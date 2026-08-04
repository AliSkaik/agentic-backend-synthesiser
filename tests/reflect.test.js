// Proves the loop's own logic against a STUBBED generator returning scripted
// outputs in sequence. No Ollama, no network, milliseconds instead of ~20 min.
//
// What is under test here is the loop, not the model: the attempt cap, the
// early exit on first success, withholding on exhaustion, that the latest
// feedback (and only the latest) reaches the next call, and that an
// infrastructure failure is typed apart from a verification failure.
//
//   node tests/reflect.test.js

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { reflect } from "../src/reflect.js";
import { OllamaTimeoutError } from "../src/config/ollama.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(here, "fixtures", name), "utf8");

const orders = fixture("orders-schema.sql");
const GOOD = fixture("v4-blog.js.txt"); // parses, references only real columns
const BAD_LAYER1 = fixture("v5-orders.js.txt"); // does not parse
const BAD_LAYER2 = fixture("v4-orders.js.txt"); // parses, invents updated_at

// GOOD is validated against the blog schema, so it must be checked against the
// blog DDL to pass. Every case below uses the orders DDL, so a stand-in that
// passes both layers under the orders schema is needed instead.
const CLEAN = `import { Router } from "express";
import { pool } from "../db.js";
const router = Router();
router.get("/customers", async (req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM customers");
    res.json(result.rows);
  } catch (err) { next(err); }
});
export default router;
`;

let failures = 0;

function check(label, condition, detail = "") {
  if (!condition) failures += 1;
  console.log(`${condition ? "OK  " : "FAIL"}  ${label}${detail ? ` ${detail}` : ""}`);
}

// A generator that hands back scripted outputs one per call. An entry that is
// an Error is thrown rather than returned, standing in for a dead endpoint.
function scripted(outputs) {
  const calls = [];
  const fn = async (ddl, opts) => {
    calls.push({ ddl, feedback: opts?.feedback ?? null });
    const next = outputs[calls.length - 1];
    if (next === undefined) throw new Error("stub exhausted: loop called generate too many times");
    if (next instanceof Error) throw next;
    return next;
  };
  fn.calls = calls;
  return fn;
}

// ---------------------------------------------------------------------------
console.log("\n--- case 1: converges on attempt 1 ---\n");
{
  const gen = scripted([CLEAN]);
  const run = await reflect(orders, { generate: gen });

  check("verified true", run.verified === true);
  check("outcome verified", run.outcome === "verified", `got ${run.outcome}`);
  check("module emitted", run.code === CLEAN);
  check("one attempt recorded", run.attempts.length === 1, `got ${run.attempts.length}`);
  check("generator called once", gen.calls.length === 1, `got ${gen.calls.length}`);
  check("no feedback on first call", gen.calls[0].feedback === null);
  check("attempt source generated", run.attempts[0].source === "generated");
  check("no feedback forwarded", run.attempts[0].feedbackSent === false);
}

// ---------------------------------------------------------------------------
console.log("\n--- case 2: converges on attempt 3, feedback forwarded ---\n");
{
  const gen = scripted([BAD_LAYER1, BAD_LAYER2, CLEAN]);
  const run = await reflect(orders, { generate: gen });

  check("verified true", run.verified === true);
  check("three attempts recorded", run.attempts.length === 3, `got ${run.attempts.length}`);
  check("attempt 1 failed layer 1", run.attempts[0].failedLayer === 1, `got ${run.attempts[0].failedLayer}`);
  check("attempt 2 failed layer 2", run.attempts[1].failedLayer === 2, `got ${run.attempts[1].failedLayer}`);
  check("attempt 2 counted violations", run.attempts[1].violationCount > 0, `got ${run.attempts[1].violationCount}`);
  check("attempt 3 verified", run.attempts[2].verified === true);

  check("call 2 carried layer 1 feedback", /Layer 1 \(syntax\)/.test(gen.calls[1].feedback ?? ""));
  check("call 3 carried layer 2 feedback", /Layer 2 \(schema\)/.test(gen.calls[2].feedback ?? ""));
  // Statelessness: only the LATEST critique travels, never an accumulation.
  check("call 3 dropped the layer 1 feedback", !/Layer 1 \(syntax\)/.test(gen.calls[2].feedback ?? ""));
  check("DDL unchanged across calls", gen.calls.every((c) => c.ddl === orders));
}

// ---------------------------------------------------------------------------
console.log("\n--- case 3: exhausts all five and emits nothing ---\n");
{
  const gen = scripted([BAD_LAYER2, BAD_LAYER2, BAD_LAYER2, BAD_LAYER2, BAD_LAYER2]);
  const run = await reflect(orders, { generate: gen });

  check("verified false", run.verified === false);
  check("outcome unverified", run.outcome === "unverified", `got ${run.outcome}`);
  check("NO module emitted", run.code === null, `got ${run.code === null ? "null" : "a module"}`);
  check("five attempts recorded", run.attempts.length === 5, `got ${run.attempts.length}`);
  check("generator called exactly five times", gen.calls.length === 5, `got ${gen.calls.length}`);
  check("last attempt did not forward feedback", run.attempts[4].feedbackSent === false);
  check("earlier attempts did forward feedback", run.attempts.slice(0, 4).every((a) => a.feedbackSent === true));
}

// ---------------------------------------------------------------------------
console.log("\n--- case 4: infrastructure failure ends the loop early ---\n");
{
  const gen = scripted([BAD_LAYER2, new OllamaTimeoutError(600000), CLEAN]);
  const run = await reflect(orders, { generate: gen });

  check("verified false", run.verified === false);
  check("outcome infrastructure", run.outcome === "infrastructure", `got ${run.outcome}`);
  check("typed apart from unverified", run.outcome !== "unverified");
  check("error type OllamaTimeout", run.error?.type === "OllamaTimeout", `got ${run.error?.type}`);
  check("no module emitted", run.code === null);
  check("loop stopped at attempt 2", run.attempts.length === 2, `got ${run.attempts.length}`);
  check("remaining attempts not spent", gen.calls.length === 2, `got ${gen.calls.length}`);
  check("failing attempt has no failedLayer", run.attempts[1].failedLayer === null);
  check("failing attempt errorType recorded", run.attempts[1].errorType === "OllamaTimeout");
}

// ---------------------------------------------------------------------------
console.log("\n--- case 5: seedCandidate skips generation for attempt 1 ---\n");
{
  const gen = scripted([CLEAN]);
  const run = await reflect(orders, { generate: gen, seedCandidate: BAD_LAYER2 });

  check("verified true", run.verified === true);
  check("two attempts recorded", run.attempts.length === 2, `got ${run.attempts.length}`);
  check("attempt 1 source seed", run.attempts[0].source === "seed");
  check("attempt 1 latency null", run.attempts[0].latencyMs === null);
  check("generator called once only", gen.calls.length === 1, `got ${gen.calls.length}`);
  check("that one call carried layer 2 feedback", /Layer 2 \(schema\)/.test(gen.calls[0].feedback ?? ""));
}

// ---------------------------------------------------------------------------
console.log("\n--- case 6: maxAttempts is honoured ---\n");
{
  const gen = scripted([BAD_LAYER2, BAD_LAYER2, BAD_LAYER2]);
  const run = await reflect(orders, { generate: gen, maxAttempts: 3 });

  check("three attempts, not five", run.attempts.length === 3, `got ${run.attempts.length}`);
  check("no module emitted", run.code === null);
}

// ---------------------------------------------------------------------------
console.log("\n--- transcript shape (attempt 2 of case 2) ---\n");
{
  const gen = scripted([BAD_LAYER1, BAD_LAYER2, CLEAN]);
  const run = await reflect(orders, { generate: gen });
  const keys = Object.keys(run.attempts[1]).sort();
  const expected = [
    "attempt",
    "errorType",
    "failedLayer",
    "feedbackSent",
    "latencyMs",
    "outputChars",
    "source",
    "verified",
    "violationCount",
  ];
  check("transcript fields exact", JSON.stringify(keys) === JSON.stringify(expected), `got ${keys.join(",")}`);
  console.log(JSON.stringify(run.attempts[1], null, 2));
}

console.log(`\n${failures === 0 ? "all assertions passed" : `${failures} assertion(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
