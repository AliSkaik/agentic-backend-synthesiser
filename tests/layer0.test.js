// Agent 3 Layer 0: the EBNF grammar check on Agent 1's DDL.
//
//   node tests/layer0.test.js
//
// Two things are asserted here that no other test can assert.
//
// First, the parser runs in two modes over the same input. `published` is the
// grammar exactly as printed in thesis §2.5.1; `extended` covers what Agent 1
// actually emits. Both verdicts come from one code path so the two acceptance
// rates are comparable, which is what Chapter IV reports.
//
// Second, Layer 0 and Layer 2 must agree about what a column is. Layer 2's
// `parseSchema` is a lexical scan; Layer 0 is a real parser. If they disagree,
// Layer 2 builds a schema map that is missing a column and then reports a valid
// column as invented a false failure, in the expensive direction, with an error
// message that points at the routes rather than at the disagreement.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { verifyGrammar } from "../src/agents/grammarVerifier.js";
import { parseSchema } from "../src/agents/relationalValidator.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(here, "fixtures", name), "utf8");

let failures = 0;

function check(name, condition, detail) {
  if (!condition) failures += 1;
  console.log(`${condition ? "OK  " : "FAIL"}  ${name}`);
  if (detail) console.log(`      ${detail}`);
}

// ---------------------------------------------------------------------------
// The contract: identical in shape to Layers 1 and 2
// ---------------------------------------------------------------------------

const minimal = `CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email VARCHAR(100)
);`;

{
  const result = verifyGrammar(minimal);
  check(
    "minimal DDL passes under the published grammar",
    result.passed === true,
    `passed=${result.passed} error=${result.error?.type ?? "none"}`
  );
  check("reports layer 0", result.layer === 0);
  check(
    "never uses the word `verified` that belongs to the orchestrator",
    !("verified" in result)
  );
}

// ---------------------------------------------------------------------------
// Malformed input: each fault must be distinguishable by type
// ---------------------------------------------------------------------------

const malformed = [
  {
    name: "unclosed parenthesis",
    ddl: "CREATE TABLE users (\n    id INTEGER PRIMARY KEY,\n    email VARCHAR(100)\n;",
    expect: "UnclosedParenthesis",
  },
  {
    name: "missing semicolon",
    ddl: "CREATE TABLE users (\n    id INTEGER PRIMARY KEY\n)",
    expect: "MissingSemicolon",
  },
  {
    name: "malformed data type",
    ddl: "CREATE TABLE users (\n    id INTEGER,\n    email VARCHAR(oops)\n);",
    expect: "MalformedDataType",
  },
  {
    name: "empty input",
    ddl: "",
    expect: "EmptyOutput",
  },
  {
    name: "prose prepended (fence-stripper leakage)",
    ddl: "Here is the schema you asked for:\n\nCREATE TABLE users (\n    id INTEGER PRIMARY KEY\n);",
    expect: "UnexpectedToken",
  },
];

for (const testCase of malformed) {
  const result = verifyGrammar(testCase.ddl);
  const actual = result.passed ? "PASSED" : result.error.type;
  check(
    `${testCase.name} reports ${testCase.expect}`,
    actual === testCase.expect,
    `got ${actual}${result.error?.line ? ` at line ${result.error.line}` : ""}`
  );
  check(
    `${testCase.name} produces re-promptable feedback`,
    typeof result.feedback === "string" && result.feedback.length > 0
  );
}

// ---------------------------------------------------------------------------
// The two modes over the real fixtures
// ---------------------------------------------------------------------------

const blog = fixture("blog-schema.sql");
const orders = fixture("orders-schema.sql");

for (const [name, ddl] of [["blog", blog], ["orders", orders]]) {
  const extended = verifyGrammar(ddl, { grammar: "extended" });
  check(
    `${name} fixture passes under the EXTENDED grammar`,
    extended.passed === true,
    extended.passed
      ? ""
      : `${extended.error.type}: ${extended.error.message} (line ${extended.error.line})`
  );

  const published = verifyGrammar(ddl, { grammar: "published" });
  check(
    `${name} fixture FAILS under the PUBLISHED grammar (the 0/2 figure)`,
    published.passed === false,
    published.passed ? "unexpectedly accepted" : `${published.error.type} at line ${published.error.line}`
  );
}

check(
  "published is the default grammar, so an unqualified call is the strict one",
  verifyGrammar(blog).passed === false
);

// ---------------------------------------------------------------------------
// Layer 0 and Layer 2 must agree about what a column is
// ---------------------------------------------------------------------------
//
// Layer 2 builds its ground truth with a lexical scan that skips definitions
// starting with a constraint keyword and takes the first identifier of
// everything else. Layer 0 knows the difference structurally. If the two ever
// disagree, Layer 2's schema map is wrong and it reports a real column as
// invented, which is the expensive failure direction: Agent 2 is sent into a
// ~200 s repair loop to fix code that was correct.

for (const [name, ddl] of [["blog", blog], ["orders", orders]]) {
  const layer0 = verifyGrammar(ddl, { grammar: "extended" });
  const layer2 = parseSchema(ddl);

  const l0Tables = [...layer0.schema.keys()].sort();
  const l2Tables = [...layer2.keys()].sort();
  check(
    `${name}: both readers find the same tables`,
    JSON.stringify(l0Tables) === JSON.stringify(l2Tables),
    `layer0=[${l0Tables}] layer2=[${l2Tables}]`
  );

  for (const table of l2Tables) {
    const l0Columns = [...(layer0.schema.get(table) ?? [])].sort();
    const l2Columns = [...layer2.get(table)].sort();
    check(
      `${name}.${table}: both readers find the same columns`,
      JSON.stringify(l0Columns) === JSON.stringify(l2Columns),
      `layer0=[${l0Columns}] layer2=[${l2Columns}]`
    );
  }
}

console.log(`\n${failures === 0 ? "all" : failures + " failed of"} assertions\n`);
process.exit(failures === 0 ? 0 : 1);
