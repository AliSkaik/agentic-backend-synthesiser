// The monolithic baseline: one call, one prompt, both artefacts.
//
// This is the control arm. Its validity rests entirely on the prompt below, so
// the prompt is defined here as an exported constant, recorded verbatim in the
// logbook before the run, and never altered between arms.
//
// WHAT THE BASELINE IS GIVEN
//
//   the task            the same natural-language description Agent 1 receives
//   the technologies    PostgreSQL, an Express router as an ES module, and
//                       pool.query against a pg pool imported from ../db.js
//   the output format   the two artefacts in one response, separately delimited
//
// WHAT THE BASELINE IS DELIBERATELY NOT GIVEN
//
//   Agent 1's normalisation instruction ("normalise to 3NF, extract lookup and
//   junction tables"), and every rule in Agent 2's system prompt: five routes
//   per table, the join-table exemption, parameterised queries, try/catch with
//   next(err), the status-code table, 404 via result.rowCount, the fixed-string
//   PUT, the DEFAULT-column allowlist for POST.
//
// Those rules ARE the harness. Supplying them to the baseline would be running
// the harness twice and calling one of the runs a control. The research question
// asks whether decomposition plus role-specialised prompting plus deterministic
// verification beats a single unstructured call; the role prompts are the
// intervention under test.
//
// WHY THE INTERFACE IS SPECIFIED ANYWAY
//
// Naming pool.query and ../db.js is not a quality hint, it is what makes the
// verifier a neutral instrument. Layer 2 recognises pool.query calls; a baseline
// that reached for a different data-access idiom would present Layer 2 with no
// statements to check and would PASS trivially. Specifying the interface removes
// a false pass in the baseline's favour. It says nothing about how to write a
// correct handler.
import { generateWithMetrics } from "../config/ollama.js";

export const SYSTEM_INSTRUCTION =
  "You are a backend engineer working with PostgreSQL and Node.js.";

/**
 * The user prompt, verbatim. `description` is the only substitution.
 */
export function buildPrompt(description) {
  return `Build the backend for the following feature.

${description}

Return both of these in a single response:

1. The PostgreSQL schema, as CREATE statements.
2. An Express router as one ES module implementing REST endpoints for that
   schema. Query the database with pool.query, using a pg connection pool
   imported from "../db.js".

Put the SQL in a \`\`\`sql code block and the JavaScript in a \`\`\`javascript code
block.`;
}

/**
 * One call, both artefacts, with token telemetry.
 *
 * @param {string} description
 * @param {{timeoutMs?: number}} [options]
 */
export async function generateMonolithic(description, { timeoutMs } = {}) {
  return generateWithMetrics(buildPrompt(description), {
    system: SYSTEM_INSTRUCTION,
    options: { temperature: 0, seed: 42 },
    timeoutMs,
  });
}

// ---------------------------------------------------------------------------
// Splitting
// ---------------------------------------------------------------------------

const looksLikeSql = (text) => /\bCREATE\s+(TABLE|TYPE|DOMAIN|INDEX|VIEW)\b/i.test(text);
const looksLikeJs = (text) => /\b(import|require|const\s+router|export\s+default)\b/.test(text);

/**
 * Separates the schema from the module.
 *
 * A failure to split is a measurement, not an error to be worked around: it
 * means the baseline produced something the pipeline's artefacts cannot be
 * compared against, which is a property of generating without staged guidance.
 * The reason is always reported so the failure modes can be counted by kind.
 *
 * @param {string} raw
 * @returns {{split: boolean, ddl: string|null, code: string|null, reason: string}}
 */
export function splitArtefacts(raw) {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { split: false, ddl: null, code: null, extraCodeBlocks: 0, reason: "empty response" };
  }

  const fenced = [...raw.matchAll(/```([A-Za-z]*)\r?\n([\s\S]*?)```/g)].map((m) => ({
    tag: m[1].toLowerCase(),
    body: m[2].trim(),
  }));

  let ddl = null;
  let code = null;

  let extraCodeBlocks = 0;

  if (fenced.length > 0) {
    // A tag is a hint, not proof. Contents decide, so a block tagged `sql` that
    // holds JavaScript is classified by what it is.
    const sqlBlocks = [];
    const jsBlocks = [];
    for (const block of fenced) {
      const isSql = looksLikeSql(block.body);
      const isJs = looksLikeJs(block.body);
      if (isSql && !isJs) sqlBlocks.push(block.body);
      else if (isJs && !isSql) jsBlocks.push(block.body);
      else if (isSql && ["sql", "postgresql", "psql"].includes(block.tag)) sqlBlocks.push(block.body);
      else if (isJs) jsBlocks.push(block.body);
    }

    // Schemas compose, so every SQL block belongs to the schema. The model
    // routinely emits one block per table with prose between them.
    if (sqlBlocks.length > 0) ddl = sqlBlocks.join("\n\n");

    // Modules do not compose: concatenating two would duplicate import bindings
    // and fail to parse, so exactly one has to be chosen. The router is the
    // artefact under comparison, and the observed second block is a usage
    // example mounting it in an app. Prefer a block that exports a router;
    // among candidates, take the longest. The count of blocks not chosen is
    // reported rather than discarded silently.
    if (jsBlocks.length > 0) {
      const routers = jsBlocks.filter((b) => /export\s+default|Router\s*\(/.test(b));
      const candidates = routers.length > 0 ? routers : jsBlocks;
      code = candidates.reduce((a, b) => (b.length > a.length ? b : a));
      extraCodeBlocks = jsBlocks.length - 1;
    }
  } else {
    // Unfenced. The boundary is the first line that opens the module.
    const lines = raw.split("\n");
    const boundary = lines.findIndex((line) => /^\s*(import\s|const\s+router\s*=)/.test(line));
    if (boundary > 0) {
      const head = lines.slice(0, boundary).join("\n").trim();
      const tail = lines.slice(boundary).join("\n").trim();
      if (looksLikeSql(head)) ddl = head;
      if (looksLikeJs(tail)) code = tail;
    } else if (looksLikeSql(raw) && !looksLikeJs(raw)) {
      ddl = raw.trim();
    } else if (looksLikeJs(raw) && !looksLikeSql(raw)) {
      code = raw.trim();
    }
  }

  if (ddl === null && code === null) {
    return { split: false, ddl: null, code: null, extraCodeBlocks, reason: "neither a schema nor a JavaScript module was found" };
  }
  if (ddl === null) {
    return { split: false, ddl: null, code, extraCodeBlocks, reason: "no schema found; only a JavaScript module" };
  }
  if (code === null) {
    return { split: false, ddl, code: null, extraCodeBlocks, reason: "no JavaScript module found; only a schema" };
  }
  return { split: true, ddl, code, extraCodeBlocks, reason: "ok" };
}
