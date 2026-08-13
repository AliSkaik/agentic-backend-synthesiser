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

// ---------------------------------------------------------------------------
// Constructs added after the 2026-08-11 live probe measured a 37.5% false
// failure rate. Each of these is valid PostgreSQL that the first build rejected.
// ---------------------------------------------------------------------------

const nowAccepted = [
  ["composite CREATE TYPE", "CREATE TYPE currency AS (\n    amount NUMERIC(19, 4),\n    code CHAR(3)\n);"],
  ["CREATE DOMAIN", "CREATE DOMAIN tag_name AS VARCHAR(255) NOT NULL;"],
  ["array column", "CREATE TABLE d (\n    id SERIAL PRIMARY KEY,\n    keywords TEXT[] NOT NULL\n);"],
  ["sized array column", "CREATE TABLE d (\n    id INT,\n    codes VARCHAR(50)[]\n);"],
  ["TIMESTAMP WITH TIME ZONE", "CREATE TABLE s (\n    id INT,\n    starts_at TIMESTAMP WITH TIME ZONE NOT NULL\n);"],
  ["TIMESTAMP WITHOUT TIME ZONE", "CREATE TABLE s (\n    id INT,\n    starts_at TIMESTAMP WITHOUT TIME ZONE\n);"],
  ["DOUBLE PRECISION", "CREATE TABLE r (\n    id INT,\n    reading DOUBLE PRECISION NOT NULL\n);"],
  ["CHARACTER VARYING", "CREATE TABLE r (\n    id INT,\n    name CHARACTER VARYING(50)\n);"],
  ["cast in DEFAULT", "CREATE TABLE a (\n    id INT,\n    balance NUMERIC DEFAULT 0::NUMERIC\n);"],
  ["row-constructor DEFAULT", "CREATE TABLE a (\n    id INT,\n    money currency DEFAULT (0::NUMERIC, 'USD'::CHAR(3))\n);"],
  ["CREATE INDEX", "CREATE TABLE d (\n    id INT,\n    body TEXT\n);\nCREATE INDEX idx_body ON d USING GIN (to_tsvector('english', body));"],
  ["CREATE UNIQUE INDEX", "CREATE TABLE d (\n    id INT\n);\nCREATE UNIQUE INDEX idx_id ON d (id);"],
];

for (const [name, ddl] of nowAccepted) {
  const result = verifyGrammar(ddl, { grammar: "extended" });
  check(
    `extended accepts ${name}`,
    result.passed === true,
    result.passed ? "" : `${result.error.type}: ${result.error.message} (line ${result.error.line})`
  );
  const strict = verifyGrammar(ddl, { grammar: "published" });
  check(`published still rejects ${name}`, strict.passed === false);
}

// Found by the Spider smoke test on 2026-08-12, on an independent sample.
// Both are valid PostgreSQL, and ALTER TABLE is named in Agent 1's own system
// prompt as permitted output.
const foundBySpider = [
  ["ALTER TABLE ADD CONSTRAINT FOREIGN KEY", "CREATE TABLE a (id INT);\nCREATE TABLE b (a_id INT);\nALTER TABLE b ADD CONSTRAINT fk_a FOREIGN KEY (a_id) REFERENCES a(id);"],
  ["ALTER TABLE ADD COLUMN", "CREATE TABLE a (id INT);\nALTER TABLE a ADD COLUMN note TEXT;"],
  ["ALTER TABLE ADD PRIMARY KEY", "CREATE TABLE a (id INT);\nALTER TABLE a ADD PRIMARY KEY (id);"],
  ["CREATE VIEW", "CREATE TABLE a (id INT, n INT);\nCREATE VIEW totals AS SELECT id, SUM(n) FROM a GROUP BY id;"],
];

for (const [name, ddl] of foundBySpider) {
  const result = verifyGrammar(ddl, { grammar: "extended" });
  check(
    `extended accepts ${name}`,
    result.passed === true,
    result.passed ? "" : `${result.error.type}: ${result.error.message} (line ${result.error.line})`
  );
  check(`published still rejects ${name}`, verifyGrammar(ddl, { grammar: "published" }).passed === false);
}

// Found by reading the 65 rejections of the 100-instance Spider run on
// 2026-08-12. Both are valid PostgreSQL. The referential actions were reported
// as UnclosedParenthesis, which is the misattribution recorded for the published
// grammar arriving again: an unrecognised construct inside a table body makes
// the closing parenthesis unreachable.
const foundBySpiderRun = [
  ["ON DELETE CASCADE", "CREATE TABLE a (id INT);\nCREATE TABLE b (\n    a_id INT REFERENCES a(id) ON DELETE CASCADE\n);"],
  ["ON DELETE SET NULL and ON UPDATE", "CREATE TABLE a (id INT);\nCREATE TABLE b (\n    a_id INT REFERENCES a(id) ON DELETE SET NULL ON UPDATE CASCADE\n);"],
  ["table-level FK with referential action", "CREATE TABLE a (id INT);\nCREATE TABLE b (\n    a_id INT,\n    FOREIGN KEY (a_id) REFERENCES a(id) ON DELETE RESTRICT\n);"],
  ["dollar-quoted function body", "CREATE TABLE s (n INT);\nCREATE OR REPLACE FUNCTION avg_n() RETURNS FLOAT AS $$\nBEGIN\n    RETURN AVG(n) FROM s;\nEND;\n$$ LANGUAGE plpgsql;"],
  ["tagged dollar quoting", "CREATE FUNCTION f() RETURNS INT AS $body$ BEGIN RETURN 1; END; $body$ LANGUAGE plpgsql;"],
];

for (const [name, ddl] of foundBySpiderRun) {
  const result = verifyGrammar(ddl, { grammar: "extended" });
  check(
    `extended accepts ${name}`,
    result.passed === true,
    result.passed ? "" : `${result.error.type}: ${result.error.message} (line ${result.error.line})`
  );
  check(`published still rejects ${name}`, verifyGrammar(ddl, { grammar: "published" }).passed === false);
}

// ---------------------------------------------------------------------------
// ScopeViolation: valid SQL that is not schema definition
// ---------------------------------------------------------------------------
//
// 53 of 100 Spider schemas carried trailing queries or sample data. Those are
// well-formed statements that do not belong to the DDL subset, and reporting
// them as UnexpectedToken conflates "the response contains more than it should"
// with "the response is malformed". The gate does not soften: these still fail.

const scopeViolations = [
  ["trailing SELECT", "CREATE TABLE a (id INT);\nSELECT COUNT(*) FROM a;"],
  ["trailing INSERT", "CREATE TABLE a (id INT);\nINSERT INTO a VALUES (1);"],
  ["trailing UPDATE", "CREATE TABLE a (id INT);\nUPDATE a SET id = 2;"],
  ["trailing DELETE", "CREATE TABLE a (id INT);\nDELETE FROM a;"],
  ["a CTE query", "CREATE TABLE a (id INT);\nWITH x AS (SELECT 1) SELECT * FROM x;"],
  ["EXPLAIN", "CREATE TABLE a (id INT);\nEXPLAIN SELECT * FROM a;"],
  ["a leading SELECT", "SELECT 1;"],
];

for (const [name, ddl] of scopeViolations) {
  for (const grammar of ["extended", "published"]) {
    const result = verifyGrammar(ddl, { grammar });
    check(
      `${grammar}: ${name} is a ScopeViolation`,
      result.passed === false && result.error.type === "ScopeViolation",
      `passed=${result.passed} type=${result.error?.type}`
    );
  }
  const feedback = verifyGrammar(ddl, { grammar: "extended" }).feedback;
  check(
    `  ${name} feedback names the real problem`,
    /not schema definition|only the schema/i.test(feedback),
    feedback.split("\n")[0]
  );
}

// A dialect error is NOT reclassified. The parser cannot distinguish "valid in
// another dialect" from "malformed" without that dialect's grammar, and a
// DialectError type that recognised this one MySQL construct and no others
// would claim a generality it does not have. Both Spider cases stay
// UnexpectedToken, and the chapter says so.
{
  const mysql = "CREATE TABLE s (\n    a INT,\n    b INT,\n    total INT AS (a + b) STORED\n);";
  const result = verifyGrammar(mysql, { grammar: "extended" });
  check(
    "MySQL generated-column syntax stays UnexpectedToken, not ScopeViolation",
    result.passed === false && result.error.type !== "ScopeViolation",
    `type=${result.error?.type}`
  );
}

// The gate must not be widened into uselessness. These stay rejected.
const stillRejected = [
  // The Spider descriptions ask questions, and the model sometimes answers them
  // with queries instead of only defining the schema. That violates its own
  // system prompt and Layer 0 must keep catching it.
  ["a bare SELECT is not schema definition", "CREATE TABLE a (id INT);\nSELECT COUNT(*) FROM a;"],
  // 5 of 100 Spider instances appended sample data. Same class as SELECT: valid
  // SQL, but not schema definition, and outside what Agent 1 was asked for.
  ["INSERT is not schema definition", "CREATE TABLE a (id INT);\nINSERT INTO a VALUES (1);"],
  ["CREATE TYPE over a base type is not valid PostgreSQL", "CREATE TYPE tag_name AS VARCHAR(255);"],
  ["malformed CREATE INDEX", "CREATE TABLE d (\n    id INT\n);\nCREATE INDEX idx_id ON d (id;"],
  ["array suffix left open", "CREATE TABLE d (\n    id INT,\n    k TEXT[\n);"],
];

for (const [name, ddl] of stillRejected) {
  const result = verifyGrammar(ddl, { grammar: "extended" });
  check(
    `extended still rejects: ${name}`,
    result.passed === false,
    result.passed ? "WRONGLY ACCEPTED" : `${result.error.type} line ${result.error.line}`
  );
}

// ---------------------------------------------------------------------------
// Regression against the committed live probe
// ---------------------------------------------------------------------------
//
// tests/fixtures/runs/2026-08-11-layer0-live/ is the "before" measurement,
// committed unchanged in 7a3a2a0. Re-checking those exact bytes is what lets the
// rate movement be stated causally: same eight generated schemas, one variable
// moved.

const probeDir = join(here, "fixtures", "runs", "2026-08-11-layer0-live", "generated");
const probe = (id) => readFileSync(join(probeDir, `${id}.sql`), "utf8");

// The one true positive. Agent 1 emitted this on a plain blog description and no
// other layer could have caught it: Layer 2 reads columns, not type
// declarations, and Layer 1 never sees the DDL. If the extension ever makes this
// pass, the extension went too far.
check(
  "c1-blog stays rejected — CREATE TYPE ... AS VARCHAR(255) does not execute",
  verifyGrammar(probe("c1-blog"), { grammar: "extended" }).passed === false,
  "the true positive from the live probe"
);

for (const id of ["p1-money", "p2-timezone", "p3-arrays"]) {
  const result = verifyGrammar(probe(id), { grammar: "extended" });
  check(
    `${id} was a false failure and is now accepted`,
    result.passed === true,
    result.passed ? "" : `${result.error.type}: ${result.error.message} (line ${result.error.line})`
  );
}

for (const id of ["c2-orders", "c3-users", "p4-floats", "p5-uuid-json"]) {
  check(
    `${id} still accepted`,
    verifyGrammar(probe(id), { grammar: "extended" }).passed === true
  );
}

// The comparative figure has to stay comparable: extending the accepted set
// must not move the published grammar's verdict on any of the eight.
const probeIds = ["c1-blog", "c2-orders", "c3-users", "p1-money", "p2-timezone", "p3-arrays", "p4-floats", "p5-uuid-json"];
const publishedAccepted = probeIds.filter((id) => verifyGrammar(probe(id), { grammar: "published" }).passed);
check(
  "published grammar still accepts 0 of the 8 live schemas",
  publishedAccepted.length === 0,
  publishedAccepted.length ? `accepted ${publishedAccepted}` : "0/8, unchanged"
);

console.log(`\n${failures === 0 ? "all" : failures + " failed of"} assertions\n`);
process.exit(failures === 0 ? 0 : 1);
