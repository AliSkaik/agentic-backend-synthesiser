// The monolithic baseline's output splitter.
//
//   node tests/monolithic.test.js
//
// The baseline returns schema and routes in one response and they must be
// separated before either verifier layer can judge them. A split failure is a
// RESULT, not an inconvenience: if the baseline emits output that cannot be
// separated, that is a property of working without a staged harness and must be
// counted as a failure rather than quietly dropped.
//
// These cases are all shapes a model plausibly returns. They were written before
// the splitter existed and before the baseline had produced anything.

import { splitArtefacts } from "../src/eval/monolithicBaseline.js";

let failures = 0;
function check(name, condition, detail) {
  if (!condition) failures += 1;
  console.log(`${condition ? "OK  " : "FAIL"}  ${name}`);
  if (detail) console.log(`      ${detail}`);
}

const DDL = "CREATE TABLE users (\n    id SERIAL PRIMARY KEY,\n    email VARCHAR(255) NOT NULL\n);";
const JS = 'import { Router } from "express";\nimport { pool } from "../db.js";\nconst router = Router();\nexport default router;';

// The requested shape: two tagged fences.
{
  const r = splitArtefacts("```sql\n" + DDL + "\n```\n\n```javascript\n" + JS + "\n```");
  check("tagged fences split", r.split === true, r.reason);
  check("  ddl recovered", r.ddl.includes("CREATE TABLE users"));
  check("  code recovered", r.code.includes("export default router"));
  check("  fences stripped from ddl", !r.ddl.includes("```"));
  check("  fences stripped from code", !r.code.includes("```"));
}

// Same, with the js tag abbreviated and prose around it.
{
  const r = splitArtefacts(
    "Here is the schema:\n\n```sql\n" + DDL + "\n```\n\nAnd the routes:\n\n```js\n" + JS + "\n```\n\nHope this helps!"
  );
  check("prose around tagged fences is discarded", r.split === true, r.reason);
  check("  no prose leaked into ddl", !r.ddl.includes("Here is the schema"));
  check("  no prose leaked into code", !r.code.includes("Hope this helps"));
}

// Untagged fences: the contents must be sniffed.
{
  const r = splitArtefacts("```\n" + DDL + "\n```\n\n```\n" + JS + "\n```");
  check("untagged fences split by content", r.split === true, r.reason);
  check("  ddl identified by CREATE TABLE", r.ddl.includes("CREATE TABLE"));
  check("  code identified by import", r.code.includes("import"));
}

// No fences at all: the boundary is where SQL stops and the module starts.
{
  const r = splitArtefacts(DDL + "\n\n" + JS);
  check("unfenced output splits at the first import", r.split === true, r.reason);
  check("  ddl stops before the import", !r.ddl.includes("import {"));
  check("  code starts at the import", r.code.trimStart().startsWith("import"));
}

// Failures, each of which must be reported rather than guessed at.
{
  const onlyDdl = splitArtefacts(DDL);
  check("schema with no routes is a split failure", onlyDdl.split === false, onlyDdl.reason);
  check("  and says which half is missing", /javascript|routes|module/i.test(onlyDdl.reason), onlyDdl.reason);

  const onlyJs = splitArtefacts(JS);
  check("routes with no schema is a split failure", onlyJs.split === false, onlyJs.reason);

  const prose = splitArtefacts("I would be happy to help you design this backend!");
  check("prose only is a split failure", prose.split === false, prose.reason);

  const empty = splitArtefacts("");
  check("empty output is a split failure", empty.split === false, empty.reason);
  check("null input is a split failure", splitArtefacts(null).split === false);
}

// Shapes observed in real baseline output on 2026-08-13. The model narrates,
// emits one fenced block per table, and follows the router with a second
// JavaScript block showing how to mount it in an app.
{
  const t1 = "CREATE TABLE faculty (\n    id SERIAL PRIMARY KEY\n);";
  const t2 = "CREATE TABLE activity (\n    id SERIAL PRIMARY KEY\n);";
  const r = splitArtefacts(
    "### Schema\n\n```sql\n" + t1 + "\n```\n\nAnd another:\n\n```sql\n" + t2 + "\n```\n\n```javascript\n" + JS + "\n```"
  );
  check("multiple SQL blocks are concatenated", r.split === true, r.reason);
  check("  first table present", r.ddl.includes("CREATE TABLE faculty"));
  check("  second table present", r.ddl.includes("CREATE TABLE activity"));
}

{
  const usage =
    "import express from 'express';\nimport facultyRouter from './routes/faculty';\nconst app = express();\napp.listen(3000);";
  const r = splitArtefacts(
    "```sql\n" + DDL + "\n```\n\n```javascript\n" + JS + "\n```\n\n### Usage\n\n```javascript\n" + usage + "\n```"
  );
  check("the router is chosen over a usage example", r.split === true, r.reason);
  check("  router module selected", r.code.includes("export default router"));
  check("  usage example discarded", !r.code.includes("app.listen"));
  check("  extra blocks are reported", r.extraCodeBlocks === 1, `got ${r.extraCodeBlocks}`);
}

// Order must not be assumed: a model may lead with the routes.
{
  const r = splitArtefacts("```javascript\n" + JS + "\n```\n\n```sql\n" + DDL + "\n```");
  check("reversed order still splits correctly", r.split === true, r.reason);
  check("  ddl is the SQL half", r.ddl.includes("CREATE TABLE"));
  check("  code is the JavaScript half", r.code.includes("export default"));
}

console.log(`\n${failures === 0 ? "all" : failures + " failed of"} assertions\n`);
process.exit(failures === 0 ? 0 : 1);
