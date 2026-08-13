// The Spider scorer, against hand-computed expectations.
//
//   node tests/spiderScorer.test.js
//
// Every number asserted here was worked out by hand from the metric
// specification committed in 2350a89, before the scorer existed. That ordering
// is the point: a scorer tested against its own output proves only that it is
// self-consistent.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readGeneratedSchema, goldSchema, scoreInstance, mapType } from "../src/eval/schemaScorer.js";
import { parseSchema } from "../src/agents/relationalValidator.js";

const here = dirname(fileURLToPath(import.meta.url));

let failures = 0;
function check(name, condition, detail) {
  if (!condition) failures += 1;
  console.log(`${condition ? "OK  " : "FAIL"}  ${name}`);
  if (detail) console.log(`      ${detail}`);
}
const near = (a, b) => Math.abs(a - b) < 1e-9;

// ---------------------------------------------------------------------------
// The generated-DDL reader
// ---------------------------------------------------------------------------

const GENERATED = `
CREATE TABLE singers (
    singer_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    birth_year INT,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE concerts (
    concert_id SERIAL PRIMARY KEY,
    singer_id INT REFERENCES singers(singer_id),
    held_on TIMESTAMP,
    FOREIGN KEY (singer_id) REFERENCES singers(singer_id)
);
`;

{
  const g = readGeneratedSchema(GENERATED);
  check("reader finds both tables", [...g.tables.keys()].sort().join(",") === "concerts,singers");
  check(
    "reader finds columns with types",
    g.tables.get("singers").get("birth_year") === "number",
    `birth_year -> ${g.tables.get("singers").get("birth_year")}`
  );
  check("SERIAL maps to number", g.tables.get("singers").get("singer_id") === "number");
  check("VARCHAR maps to text", g.tables.get("singers").get("name") === "text");
  check("BOOLEAN maps to boolean", g.tables.get("singers").get("is_active") === "boolean");
  check("TIMESTAMP maps to time", g.tables.get("concerts").get("held_on") === "time");

  // Both the inline REFERENCES and the table-level FOREIGN KEY name the same
  // relationship; it must be counted once.
  check(
    "reader deduplicates inline and table-level foreign keys",
    g.foreignKeys.length === 1,
    JSON.stringify(g.foreignKeys)
  );
  check(
    "foreign key is directed child -> parent",
    g.foreignKeys[0].from.table === "concerts" && g.foreignKeys[0].to.table === "singers"
  );

  // Spec item 2: the table and column set must agree with parseSchema, which is
  // the reader the specification names.
  const lex = parseSchema(GENERATED);
  const sameTables = [...g.tables.keys()].sort().join() === [...lex.keys()].sort().join();
  const sameCols = [...lex.keys()].every(
    (t) => [...g.tables.get(t).keys()].sort().join() === [...lex.get(t)].sort().join()
  );
  check("reader agrees with parseSchema on tables and columns", sameTables && sameCols);
}

// ---------------------------------------------------------------------------
// Type mapping
// ---------------------------------------------------------------------------

for (const [pg, want] of [
  ["INTEGER", "number"], ["BIGSERIAL", "number"], ["NUMERIC(10, 2)", "number"],
  ["DOUBLE PRECISION", "number"], ["MONEY", "number"],
  ["VARCHAR(255)", "text"], ["TEXT", "text"], ["CHARACTER VARYING(50)", "text"], ["UUID", "text"],
  ["DATE", "time"], ["TIMESTAMP WITH TIME ZONE", "time"], ["INTERVAL", "time"],
  ["BOOL", "boolean"],
  ["JSONB", "others"], ["TEXT[]", "others"], ["some_enum", "others"],
]) {
  check(`${pg} -> ${want}`, mapType(pg) === want, `got ${mapType(pg)}`);
}

// ---------------------------------------------------------------------------
// Scoring, hand-computed
// ---------------------------------------------------------------------------
//
// Gold: singer(singer_id, name), concert(concert_id, singer_id)
//       FK concert.singer_id -> singer.singer_id
// Generated as above: singers(singer_id, name, birth_year, is_active),
//                     concerts(concert_id, singer_id, held_on)
//
// EXACT matching: "singers" != "singer", "concerts" != "concert".
//   tables   matched 0 -> precision 0/2, recall 0/2
//   columns  matched 0 (no matched table to look inside)
//   FK       matched 0
//
// NORMALISED matching: plural stripped, so both tables match.
//   tables   matched 2 -> precision 2/2 = 1, recall 2/2 = 1
//   columns  generated 7, gold 4, matched: singer_id, name, concert_id,
//            singer_id = 4 -> precision 4/7, recall 4/4 = 1
//   FK       matched 1 -> precision 1/1, recall 1/1

const gold = {
  tables: new Map([
    ["singer", new Map([["singer_id", "number"], ["name", "text"]])],
    ["concert", new Map([["concert_id", "number"], ["singer_id", "number"]])],
  ]),
  foreignKeys: [
    { from: { table: "concert", column: "singer_id" }, to: { table: "singer", column: "singer_id" } },
  ],
};

{
  const exact = scoreInstance(gold, readGeneratedSchema(GENERATED), { matching: "exact" });
  check("exact: no tables match", exact.tables.matched === 0, JSON.stringify(exact.tables));
  check("exact: table precision 0", near(exact.tables.precision, 0));
  check("exact: no columns match", exact.columns.matched === 0);
  check("exact: no foreign keys match", exact.foreignKeys.matched === 0);

  const norm = scoreInstance(gold, readGeneratedSchema(GENERATED), { matching: "normalised" });
  check("normalised: both tables match", norm.tables.matched === 2, JSON.stringify(norm.tables));
  check("normalised: table precision 1", near(norm.tables.precision, 1));
  check("normalised: table recall 1", near(norm.tables.recall, 1));
  check("normalised: 4 columns match", norm.columns.matched === 4, JSON.stringify(norm.columns));
  check("normalised: column precision 4/7", near(norm.columns.precision, 4 / 7));
  check("normalised: column recall 1", near(norm.columns.recall, 1));
  check("normalised: FK matches", norm.foreignKeys.matched === 1);
  check("normalised: FK precision and recall 1", near(norm.foreignKeys.precision, 1) && near(norm.foreignKeys.recall, 1));
  check(
    "normalised: type accuracy 1 over matched columns",
    near(norm.types.accuracy, 1),
    JSON.stringify(norm.types)
  );
}

// A foreign key pointing the wrong way must not count.
{
  const reversed = readGeneratedSchema(`
CREATE TABLE singers (singer_id SERIAL PRIMARY KEY, name VARCHAR(100));
CREATE TABLE concerts (concert_id SERIAL PRIMARY KEY, singer_id INT);
ALTER TABLE singers ADD FOREIGN KEY (singer_id) REFERENCES concerts(singer_id);
`);
  const s = scoreInstance(gold, reversed, { matching: "normalised" });
  check("a reversed foreign key does not match", s.foreignKeys.matched === 0, JSON.stringify(s.foreignKeys));
}

// Unparseable or empty output: recall 0, precision undefined and excluded.
{
  const empty = scoreInstance(gold, readGeneratedSchema("I'm sorry, I cannot help with that."), {
    matching: "normalised",
  });
  check("no schema: recall 0", near(empty.tables.recall, 0));
  check("no schema: precision null, not zero", empty.tables.precision === null, `got ${empty.tables.precision}`);
  check("no schema: flagged as producing nothing", empty.empty === true);
}

// ---------------------------------------------------------------------------
// Gold extraction from the committed tables.json
// ---------------------------------------------------------------------------

{
  const tables = JSON.parse(readFileSync(join(here, "spider", "tables.json"), "utf8"));
  const g = goldSchema(tables.find((d) => d.db_id === "perpetrator"));
  check("gold: 2 tables for perpetrator", g.tables.size === 2, [...g.tables.keys()].join(","));
  check("gold: the synthetic * column is excluded", ![...g.tables.values()].some((c) => c.has("*")));
  check("gold: 1 foreign key", g.foreignKeys.length === 1, JSON.stringify(g.foreignKeys));
  check(
    "gold: FK is people <- perpetrator, directed",
    g.foreignKeys[0].from.table === "perpetrator" && g.foreignKeys[0].to.table === "people",
    JSON.stringify(g.foreignKeys[0])
  );
  check("gold: types come through as Spider categories", g.tables.get("perpetrator").get("perpetrator_id") === "number");
}

console.log(`\n${failures === 0 ? "all" : failures + " failed of"} assertions\n`);
process.exit(failures === 0 ? 0 : 1);
