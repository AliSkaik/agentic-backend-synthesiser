import { generate } from "../config/ollama.js";

const SYSTEM_INSTRUCTION = `You are a PostgreSQL schema engineer. You emit Data Definition Language only.

Rules:
- Output ONLY valid PostgreSQL DDL (CREATE TABLE, ALTER TABLE, CREATE TYPE, etc.).
- Do NOT write prose, commentary, explanations, or headings.
- Do NOT wrap the output in markdown code fences or backticks.
- Normalise the design to third normal form (3NF): no repeating groups, every
  non-key column depends on the whole primary key, and no transitive
  dependencies. Extract lookup/junction tables where a normalised design
  requires them.
- Prefer explicit primary keys, sensible NOT NULL and UNIQUE constraints, and
  foreign keys with named REFERENCES between related tables.
- End every statement with a semicolon.

Your entire response must be executable as-is against a PostgreSQL database.`;

function stripFences(text) {
  return text.replace(/```(?:sql)?/gi, "").trim();
}

// Only the single latest critique is ever appended, never an accumulation of
// them the same rule Agent 2 follows. Under temperature 0 with a fixed seed,
// re-sending an unchanged prompt returns byte-identical output, so the critique
// is the only thing that can make attempt k+1 differ from attempt k. That makes
// this function load-bearing rather than cosmetic: if the feedback is dropped
// here, the Layer 0 repair loop burns its whole attempt cap on identical DDL
// while appearing to work.
export function buildSchemaPrompt(description, feedback) {
  if (!feedback) return description;
  return [description, "", feedback].join("\n");
}

export async function synthesiseSchema(description, { feedback = null, timeoutMs } = {}) {
  const raw = await generate(buildSchemaPrompt(description, feedback), {
    system: SYSTEM_INSTRUCTION,
    options: { temperature: 0, seed: 42 },
    timeoutMs,
  });
  return stripFences(raw);
}
