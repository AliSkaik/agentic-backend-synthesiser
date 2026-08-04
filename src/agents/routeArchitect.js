// Agent 2
// Consumes the DDL emitted by Agent 1 and produces the route definitions
import { generate } from "../config/ollama.js";

const SYSTEM_INSTRUCTION = `You are an Express.js API engineer. You emit JavaScript only.

You are given PostgreSQL DDL. Emit one ES module that exports an Express router
implementing REST endpoints for the tables in that DDL.

Rules:
- Output ONLY valid JavaScript. No prose, commentary, explanations, or headings.
- Do NOT wrap the output in markdown code fences or backticks.
- Use ES module syntax (import/export), never require().
- Begin with exactly these two imports and nothing else:
  import { Router } from "express";
  import { pool } from "../db.js";
- Create one router with const router = Router(); and end the file with
  export default router;
- For every table with a single-column primary key, emit five routes:
  GET /<table>, GET /<table>/:id, POST /<table>, PUT /<table>/:id,
  DELETE /<table>/:id. Use the table name verbatim as the path segment.
- A join table (composite primary key made only of foreign keys) is NOT a
  resource. For each one emit nested routes under the owning table instead:
  GET /<owner>/:ownerId/<other>, POST /<owner>/:ownerId/<other>,
  DELETE /<owner>/:ownerId/<other>/:otherId.
- Query the database with pool.query. Pass all user input as parameters
  ($1, $2, ...). NEVER interpolate request data into a SQL string.
- Wrap every handler body in try/catch and call next(err) in the catch.
- Return 200 with the row(s) for GET and PUT, 201 with the created row for
  every POST, and 204 with no body for a DELETE that removed a row.
- When a write or delete matches no row, respond 404 with { error: "Not found" }.
  Test this with result.rowCount === 0, including on DELETE.
- Do not invent columns. Use only the columns declared in the DDL, and never
  accept a SERIAL primary key in a POST or PUT body.

Two requirements you must apply to every table, without exception:

1. PUT handlers are always written with a fixed SQL string. Name every
   updatable column in the SET list with a numbered parameter, put the :id
   last, and never build a PUT's SET list with .map or .join:

   const { title, content, author_id } = req.body;
   const result = await pool.query(
     "UPDATE posts SET title = $1, content = $2, author_id = $3 WHERE id = $4 RETURNING *",
     [title, content, author_id, id]
   );

2. POST handlers only. A column declared with a DEFAULT must not be named in
   an INSERT unless the request supplied it, otherwise the default is
   overwritten with NULL. Build INSERTs exactly like this, taking the allowlist
   from the DDL and never from req.body keys. Reject an empty body with 400
   before querying, so the column list is never empty:

   const allowed = ["username", "email", "password_hash", "role"];
   const cols = allowed.filter((c) => req.body[c] !== undefined);
   if (cols.length === 0) {
     return res.status(400).json({ error: "Empty body" });
   }
   const values = cols.map((c) => req.body[c]);
   const params = cols.map((_, i) => "$" + (i + 1));
   const result = await pool.query(
     "INSERT INTO users (" + cols.join(", ") + ") VALUES (" + params.join(", ") + ") RETURNING *",
     values
   );

Your entire response must run as-is under Node.js.`;

function stripFences(text) {
  return text.replace(/```(?:javascript|js)?/gi, "").trim();
}

// Feedback from Agent 3 is appended to the USER prompt, never merged into
// SYSTEM_INSTRUCTION. The system prompt is the artefact under study across
// v1-v5; mutating it inside a repair loop would mean the prompt-iteration
// experiment and the reflection experiment are no longer measuring separate
// things, and no result from either could be attributed to one cause.
//
// Only the single latest feedback string is ever passed. Accumulating critiques
// is ruled out by Week 8 limitation 1 (constraint saturation) each added rule
// costs an existing one, so spending capacity on history rather than on the
// correction is the wrong trade at 7b.
// The sentence framing the critique. Without it a re-prompt reads as a second,
// unrelated instruction block rather than as a correction to the first.
//
// It is a parameter rather than a literal because it is an EXPERIMENTAL
// VARIABLE, not a detail. A repair prompt carries two things that could be
// causing a repair: Agent 3's critique, and this framing. The first live run
// (2026-08-04) could not tell them apart, so it supports "the model repaired
// from the critique plus this sentence" and not the stronger claim. Passing
// `preamble: null` omits it, which is what makes the two separable.
export const DEFAULT_FEEDBACK_PREAMBLE =
  "Your previous attempt at this task was rejected by an automated check.";

function buildPrompt(ddl, feedback, preamble) {
  if (!feedback) return ddl;
  if (!preamble) return [ddl, "", feedback].join("\n");
  return [ddl, "", preamble, "", feedback].join("\n");
}

export async function designRoutes(
  ddl,
  { feedback = null, timeoutMs, preamble = DEFAULT_FEEDBACK_PREAMBLE } = {}
) {
  const raw = await generate(buildPrompt(ddl, feedback, preamble), {
    system: SYSTEM_INSTRUCTION,
    options: { temperature: 0, seed: 42 },
    timeoutMs,
  });
  return stripFences(raw);
}
