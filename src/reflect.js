// The N=5 self-healing reflection loop.
//
// Agent 2 runs at temperature 0 with a fixed seed, so this loop cannot retry:
// re-issuing an unchanged request returns the same defective module every time.
// The only reason attempt k+1 can differ from attempt k is that the prompt
// changed, and the only thing changing it is Agent 3's `feedback` string. That
// makes `feedback` load-bearing rather than cosmetic.
//
// This module owns the attempt cap, the re-prompt, the transcript, and the
// emit decision. Its entire view of verification is one boolean and one string,
// so a third layer added to verify() needs no change here.
import { designRoutes } from "./agents/routeArchitect.js";
import { verify } from "./verify.js";

export const DEFAULT_MAX_ATTEMPTS = 5;

// Counts `router.<method>(` calls in the raw text.
//
// This is a REPORTING metric and never a verdict, which is what licenses a
// regex here. Its purpose is to make one specific failure visible in the
// transcript: the gate asserts soundness only, so deleting a route is a valid
// way to stop referencing a column that does not exist. The first live run did
// exactly that repaired the named column and silently dropped three
// `order_line_items` routes and the transcript showed a clean convergence,
// because nothing recorded that the API had shrunk. That was found by reading
// two modules side by side, which will not happen across a full run.
//
// Deliberately lexical rather than AST-based: an attempt that fails Layer 1 has
// no AST at all, and those are precisely the attempts worth comparing against
// their successor. A lexical count is available for every attempt, verified or
// not. It will miscount if a route is declared some other way (a method name
// held in a variable, a router built by a helper); Agent 2's system prompt
// mandates the literal form, so that is a tolerable inaccuracy in a number that
// cannot change a pass into a fail.
const ROUTE_CALL = /\brouter\s*\.\s*(?:get|post|put|patch|delete|all)\s*\(/g;

function countRoutes(code) {
  if (typeof code !== "string") return null;
  return (code.match(ROUTE_CALL) ?? []).length;
}

// N=5 means five GENERATIONS in total: one initial plus up to four repairs.
// Not one plus five. The alternative reading is equally natural and the figure
// appears in the results, so it is fixed here.

/**
 * @param {string} ddl
 * @param {object} [options]
 * @param {number}   [options.maxAttempts=5]    total generations, initial included
 * @param {string}   [options.seedCandidate]    used as attempt 1 instead of generating
 * @param {number}   [options.timeoutMs]        forwarded to the Ollama call
 * @param {Function} [options.generate]         injected for testing; (ddl, {feedback, timeoutMs}) => code
 * @returns {Promise<{
 *   code: string|null,
 *   verified: boolean,
 *   outcome: "verified"|"unverified"|"infrastructure",
 *   error: {type: string, message: string}|null,
 *   attempts: object[]
 * }>}
 */
export async function reflect(ddl, options = {}) {
  const {
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    seedCandidate = null,
    timeoutMs,
    generate = designRoutes,
  } = options;

  const attempts = [];
  let feedback = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // Attempt 1 may come from a recorded fixture instead of the model, which
    // removes ~200 s from every iteration and makes a run reproducible without
    // depending on Agent 2 reproducing its Week 8 output under a future model
    // or Ollama version (Week 7 limitation 3 declines to guarantee that).
    const seeded = attempt === 1 && seedCandidate !== null;

    let code;
    const started = performance.now();
    if (seeded) {
      code = seedCandidate;
    } else {
      try {
        code = await generate(ddl, { feedback, timeoutMs });
      } catch (err) {
        // An unreachable or slow model is NOT a verification failure. Recording
        // "the model never answered" as "the model produced bad code" would
        // corrupt the convergence rate, which is the headline figure of the
        // experiment. The loop ends here rather than burning the remaining
        // attempts against an endpoint that is not responding.
        attempts.push({
          attempt,
          source: "generated",
          latencyMs: Math.round(performance.now() - started),
          outputChars: null,
          routeCount: null,
          verified: false,
          failedLayer: null,
          errorType: err?.type ?? err?.name ?? "Error",
          violationCount: 0,
          feedbackSent: false,
        });
        return {
          code: null,
          verified: false,
          outcome: "infrastructure",
          error: {
            type: err?.type ?? err?.name ?? "Error",
            message: err?.message ?? String(err),
          },
          attempts,
        };
      }
    }
    const latencyMs = Math.round(performance.now() - started);

    const verdict = verify(code, ddl);
    const isLast = attempt === maxAttempts;

    attempts.push({
      attempt,
      source: seeded ? "seed" : "generated",
      latencyMs: seeded ? null : latencyMs,
      outputChars: typeof code === "string" ? code.length : null,
      // A drop between consecutive attempts means a repair removed routes. The
      // gate cannot see that, so the transcript must.
      routeCount: countRoutes(code),
      verified: verdict.verified,
      failedLayer: verdict.layer,
      errorType: verdict.error?.type ?? null,
      violationCount: verdict.error?.violations?.length ?? 0,
      // Whether THIS attempt's feedback actually fed a further attempt. False
      // on the last one, where the critique is produced and then discarded.
      feedbackSent: !verdict.verified && !isLast,
    });

    if (verdict.verified) {
      return { code, verified: true, outcome: "verified", error: null, attempts };
    }

    feedback = verdict.feedback;
  }

  // Exhaustion emits NOTHING. Returning the best or first candidate tagged
  // `verified: false` invites a caller to use it anyway, which is the false-pass
  // failure mode this whole agent was built in response to (Week 8 limitation
  // 2). The withheld module is not the measurement; the transcript is.
  return {
    code: null,
    verified: false,
    outcome: "unverified",
    error: null,
    attempts,
  };
}
