// The Agent 1 repair loop.
//
// This is the second reflection path, and it is deliberately a separate loop
// rather than a third layer inside verify(). The DDL is fixed for the whole
// duration of the Agent 2 loop in reflect.js, so checking it there would re-run
// an identical check on every Agent 2 attempt and would leave that loop to work
// out which agent a failure belongs to. Here the answer is structural: whatever
// fails in this file was produced by Agent 1, so this file re-prompts Agent 1.
//
//   Layer 0        -> Agent 1   (this module)
//   Layers 1 and 2 -> Agent 2   (src/reflect.js)
//
// The two loops have the same shape on purpose the attempt cap, the single
// latest feedback string, the emit-nothing-on-exhaustion rule, and the
// infrastructure-is-not-a-verification-failure rule are all decisions already
// argued in reflect.js, and re-deciding them differently here would mean the
// thesis had to describe two conventions instead of one.
import { synthesiseSchema } from "./agents/schemaSynthesiser.js";
import { verifyGrammar } from "./agents/grammarVerifier.js";

export const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * @param {string} description  the natural-language feature description
 * @param {object} [options]
 * @param {number}   [options.maxAttempts=5]  total generations, initial included
 * @param {number}   [options.timeoutMs]      forwarded to the Ollama call
 * @param {"published"|"extended"} [options.grammar="extended"]
 *   The pipeline gates on the extended grammar, because the published one
 *   rejects every DDL Agent 1 has ever produced and would loop forever with
 *   nothing to repair. `published` is available so the evaluation harness can
 *   record both verdicts over the same output; it is not a usable gate.
 * @param {Function} [options.generate]  injected for testing
 * @returns {Promise<{
 *   ddl: string|null,
 *   schema: Map<string, Set<string>>|null,
 *   verified: boolean,
 *   outcome: "verified"|"unverified"|"infrastructure",
 *   error: {type: string, message: string}|null,
 *   attempts: object[]
 * }>}
 */
export async function synthesiseVerifiedSchema(description, options = {}) {
  const {
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    timeoutMs,
    grammar = "extended",
    generate = synthesiseSchema,
  } = options;

  const attempts = [];
  let feedback = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let ddl;
    const started = performance.now();

    try {
      ddl = await generate(description, { feedback, timeoutMs });
    } catch (err) {
      // Same rule as reflect.js: an unreachable model is not a defective
      // schema. Recording it as one would corrupt the convergence rate.
      attempts.push({
        attempt,
        latencyMs: Math.round(performance.now() - started),
        outputChars: null,
        tableCount: null,
        verified: false,
        failedLayer: null,
        errorType: err?.type ?? err?.name ?? "Error",
        feedbackSent: false,
      });
      return {
        ddl: null,
        schema: null,
        verified: false,
        outcome: "infrastructure",
        error: { type: err?.type ?? err?.name ?? "Error", message: err?.message ?? String(err) },
        attempts,
      };
    }

    const latencyMs = Math.round(performance.now() - started);
    const verdict = verifyGrammar(ddl, { grammar });
    const isLast = attempt === maxAttempts;

    attempts.push({
      attempt,
      latencyMs,
      outputChars: typeof ddl === "string" ? ddl.length : null,
      // The Agent 2 loop counts routes so a repair that deletes an endpoint is
      // visible in the transcript. The same failure mode applies here: a repair
      // can satisfy the grammar by dropping a table.
      tableCount: verdict.schema?.size ?? null,
      verified: verdict.passed,
      failedLayer: verdict.passed ? null : 0,
      errorType: verdict.error?.type ?? null,
      feedbackSent: !verdict.passed && !isLast,
    });

    if (verdict.passed) {
      return {
        ddl,
        schema: verdict.schema,
        verified: true,
        outcome: "verified",
        error: null,
        attempts,
      };
    }

    feedback = verdict.feedback;
  }

  // Exhaustion emits nothing, for the reason recorded in reflect.js: returning
  // a candidate tagged `verified: false` invites a caller to use it anyway.
  return { ddl: null, schema: null, verified: false, outcome: "unverified", error: null, attempts };
}
