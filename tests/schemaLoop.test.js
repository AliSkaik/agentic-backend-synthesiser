// The Agent 1 repair loop: Layer 0 runs on the DDL before Agent 2 is ever
// called, and a grammar failure re-prompts Agent 1 rather than Agent 2.
//
//   node tests/schemaLoop.test.js
//
// Agent 1 is injected, so these cases run in milliseconds and assert the loop's
// control flow rather than the model's behaviour. What the live model does with
// the feedback is a separate question, answered by a live run in the logbook.

import { synthesiseVerifiedSchema } from "../src/synthesise.js";
import { buildSchemaPrompt } from "../src/agents/schemaSynthesiser.js";

let failures = 0;

function check(name, condition, detail) {
  if (!condition) failures += 1;
  console.log(`${condition ? "OK  " : "FAIL"}  ${name}`);
  if (detail) console.log(`      ${detail}`);
}

const VALID = "CREATE TABLE users (\n    id SERIAL PRIMARY KEY,\n    email VARCHAR(100) NOT NULL\n);";
const BROKEN = "CREATE TABLE users (\n    id SERIAL PRIMARY KEY,\n    email VARCHAR(100)\n;";

// A generator that returns each scripted response in turn and records the
// feedback it was handed.
function scripted(responses) {
  const seen = [];
  const generate = async (description, { feedback } = {}) => {
    seen.push(feedback ?? null);
    return responses[Math.min(seen.length - 1, responses.length - 1)];
  };
  return { generate, seen };
}

// ---------------------------------------------------------------------------

{
  const { generate, seen } = scripted([VALID]);
  const result = await synthesiseVerifiedSchema("users", { generate });

  check("valid DDL converges on the first attempt", result.verified === true);
  check("returns the DDL", result.ddl === VALID);
  check("calls Agent 1 exactly once", seen.length === 1, `called ${seen.length} times`);
  check("first call carries no feedback", seen[0] === null);
  check("records one attempt", result.attempts.length === 1);
  check("exposes the parsed schema for later layers", result.schema?.has("users") === true);
}

{
  const { generate, seen } = scripted([BROKEN, VALID]);
  const result = await synthesiseVerifiedSchema("users", { generate });

  check("a grammar failure is repaired on the second attempt", result.verified === true);
  check("Agent 1 is re-prompted, not Agent 2", seen.length === 2, `called ${seen.length} times`);
  check(
    "the repair prompt carries Layer 0 feedback",
    typeof seen[1] === "string" && seen[1].includes("Layer 0"),
    seen[1] === null ? "no feedback sent" : seen[1].split("\n")[0]
  );
  check("the transcript records the failing layer", result.attempts[0].failedLayer === 0);
  check("the transcript records the error type", result.attempts[0].errorType === "UnclosedParenthesis");
}

{
  const { generate, seen } = scripted([BROKEN]);
  const result = await synthesiseVerifiedSchema("users", { generate, maxAttempts: 3 });

  check("exhaustion stops at the attempt cap", seen.length === 3, `called ${seen.length} times`);
  check("exhaustion emits nothing", result.ddl === null);
  check("exhaustion is not verified", result.verified === false);
  check("exhaustion is reported as unverified, not infrastructure", result.outcome === "unverified");
  check(
    "the last attempt records that its feedback went nowhere",
    result.attempts[2].feedbackSent === false
  );
}

{
  const generate = async () => {
    throw Object.assign(new Error("connect ECONNREFUSED"), { type: "ConnectionRefused" });
  };
  const result = await synthesiseVerifiedSchema("users", { generate });

  check("an unreachable model is not a verification failure", result.outcome === "infrastructure");
  check("the loop stops rather than burning its attempts", result.attempts.length === 1);
}

{
  const { generate } = scripted([VALID]);
  const strict = await synthesiseVerifiedSchema("users", { generate, grammar: "published" });
  check(
    "the grammar mode is selectable, and the extended one is the pipeline default",
    strict.verified === false && strict.attempts[0].failedLayer === 0,
    "SERIAL and NOT NULL are outside the published grammar, so this DDL fails it"
  );
}

// ---------------------------------------------------------------------------
// Agent 1 must actually carry the critique into the next prompt
// ---------------------------------------------------------------------------
//
// The cases above inject a generator, so they prove the loop routes feedback to
// Agent 1 they cannot prove Agent 1 does anything with it. Without this,
// every repair attempt would re-send the original description unchanged, and
// under temperature 0 with a fixed seed that returns byte-identical broken DDL
// until the attempt cap. The loop would look like it was working.

{
  const plain = buildSchemaPrompt("a blog", null);
  check("with no feedback the prompt is the description alone", plain === "a blog");

  const repair = buildSchemaPrompt("a blog", "Layer 0 (grammar): unclosed parenthesis");
  check(
    "with feedback the prompt carries the description and the critique",
    repair.includes("a blog") && repair.includes("Layer 0 (grammar)"),
    repair.replace(/\n/g, " | ")
  );
}

console.log(`\n${failures === 0 ? "all" : failures + " failed of"} assertions\n`);
process.exit(failures === 0 ? 0 : 1);
