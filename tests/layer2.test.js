// Runs Layer 1 then Layer 2 over the real Agent 2 outputs recorded in Week 8.
// Fixtures are stored as .js.txt so Node never tries to load them as modules
// v5-orders does not parse, which is the point of it.
//
// The layers are driven through verify(), not called directly, because verify()
// now owns the chaining and the short-circuit these cases assert: v5-orders
// must fail at Layer 1 and never reach Layer 2. Expected results are unchanged
// from when the two layers were called by hand here.
//
//   node tests/layer2.test.js

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { verify } from "../src/verify.js";

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
  const result = verify(testCase.code, testCase.ddl);
  const actual = result.verified ? "pass" : `fail-layer${result.layer}`;

  const ok = actual === testCase.expect;
  if (!ok) failures += 1;

  console.log(`${ok ? "OK  " : "FAIL"}  ${testCase.name.padEnd(10)} expected ${testCase.expect}, got ${actual}`);
  console.log(`      ${testCase.why}`);
  if (!result.verified) {
    console.log(`      error: ${result.error.type} ${result.error.message}`);
  }
  console.log();
}

console.log("--- Layer 2 feedback for v4-orders ---\n");
const proof = cases[0];
console.log(verify(proof.code, proof.ddl).feedback);

console.log(`\n${cases.length - failures}/${cases.length} cases as expected`);
process.exit(failures === 0 ? 0 : 1);
