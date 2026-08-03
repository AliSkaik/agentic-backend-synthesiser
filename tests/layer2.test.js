// Runs Layer 1 then Layer 2 over the real Agent 2 outputs recorded in Week 8.
// Fixtures are stored as .js.txt so Node never tries to load them as modules
// v5-orders does not parse, which is the point of it.
//
//   node tests/layer2.test.js

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { verifyIntegrity } from "../src/agents/integrityVerifier.js";
import { validateRelations } from "../src/agents/relationalValidator.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(here, "fixtures", name), "utf8");

const blog = fixture("blog-schema.sql");
const orders = fixture("orders-schema.sql");

const cases = [
  {
    name: "v4-orders",
    code: fixture("v4-orders.js.txt"),
    ddl: orders,
    expect: "fail-layer2",
    why: "invents updated_at; the orders schema declares no such column",
  },
  {
    name: "v4-blog",
    code: fixture("v4-blog.js.txt"),
    ddl: blog,
    expect: "pass",
    why: "same generator version, but posts.updated_at exists control case",
  },
  {
    name: "v5-blog",
    code: fixture("v5-blog.js.txt"),
    ddl: blog,
    expect: "pass",
    why: "columns are all real; its defect (req.body vs req.params) is not this check",
  },
  {
    name: "v5-orders",
    code: fixture("v5-orders.js.txt"),
    ddl: orders,
    expect: "fail-layer1",
    why: "array comprehension does not parse; must never reach Layer 2",
  },
];

let failures = 0;

for (const testCase of cases) {
  const layer1 = verifyIntegrity(testCase.code);

  let actual;
  let result = layer1;
  if (!layer1.passed) {
    actual = "fail-layer1";
  } else {
    result = validateRelations(layer1.ast, testCase.ddl);
    actual = result.passed ? "pass" : "fail-layer2";
  }

  const ok = actual === testCase.expect;
  if (!ok) failures += 1;

  console.log(`${ok ? "OK  " : "FAIL"}  ${testCase.name.padEnd(10)} expected ${testCase.expect}, got ${actual}`);
  console.log(`      ${testCase.why}`);
  if (!result.passed) {
    console.log(`      error: ${result.error.type} ${result.error.message}`);
  }
  console.log();
}

console.log("--- Layer 2 feedback for v4-orders ---\n");
const proof = cases[0];
const parsed = verifyIntegrity(proof.code);
console.log(validateRelations(parsed.ast, proof.ddl).feedback);

console.log(`\n${cases.length - failures}/${cases.length} cases as expected`);
process.exit(failures === 0 ? 0 : 1);
