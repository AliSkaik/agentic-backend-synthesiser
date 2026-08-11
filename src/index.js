// End-to-end run: description -> verified schema -> verified routes.
//
// Two reflection loops in sequence, each gating the agent that produced its
// artefact. Nothing reaches Agent 2 until the DDL has passed Layer 0, because
// Layers 1 and 2 both consume that DDL and a malformed one would send Agent 2
// into a repair loop for a defect it did not cause.
import { synthesiseVerifiedSchema } from "./synthesise.js";
import { reflect } from "./reflect.js";

const description =
  "Create a PostgreSQL table for users with id, email and created_at columns";

const schema = await synthesiseVerifiedSchema(description);
console.log(`Agent 1: ${schema.outcome} after ${schema.attempts.length} attempt(s)`);

if (!schema.verified) {
  // Verified-or-nothing. A schema that failed the grammar is not handed on.
  console.error(schema.error ?? "Layer 0 did not converge; no schema emitted.");
  console.error(JSON.stringify(schema.attempts, null, 2));
  process.exit(1);
}

console.log(schema.ddl);

const routes = await reflect(schema.ddl);
console.log(`Agent 2: ${routes.outcome} after ${routes.attempts.length} attempt(s)`);

if (!routes.verified) {
  console.error(routes.error ?? "The reflection loop did not converge; no module emitted.");
  console.error(JSON.stringify(routes.attempts, null, 2));
  process.exit(1);
}

console.log(routes.code);
