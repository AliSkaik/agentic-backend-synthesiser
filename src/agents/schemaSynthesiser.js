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

export async function synthesiseSchema(prompt) {
  const raw = await generate(prompt, {
    system: SYSTEM_INSTRUCTION,
    options: { temperature: 0, seed: 42 },
  });
  return stripFences(raw);
}
