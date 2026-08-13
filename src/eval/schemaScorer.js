// Scores a generated PostgreSQL schema against a Spider gold schema.
//
// Implements the metric specification committed in 2350a89, which was written
// before this file existed and before any instance was generated. Where this
// implementation had to go beyond the specification, it is marked AMENDMENT and
// recorded in the results logbook entry the specification names `parseSchema` as
// the reader, and `parseSchema` returns tables and columns only. Types and
// foreign keys need extraction the specification assumed was already there.
//
// The amendment is a mechanism detail, not a scoring rule: no threshold,
// matching rule or formula changed. `readGeneratedSchema` is asserted in
// tests/spiderScorer.test.js to produce the same table and column sets as
// `parseSchema`, so the reader the specification names remains the authority on
// what counts as a table and what counts as a column.

// ---------------------------------------------------------------------------
// Type mapping — specification item 9, fixed before the run
// ---------------------------------------------------------------------------

const NUMBER = new Set([
  "INT", "INTEGER", "SMALLINT", "BIGINT", "SERIAL", "BIGSERIAL", "SMALLSERIAL",
  "NUMERIC", "DECIMAL", "REAL", "FLOAT", "MONEY", "DOUBLE",
]);
const TEXT = new Set(["CHAR", "VARCHAR", "CHARACTER", "TEXT", "UUID"]);
const TIME = new Set(["DATE", "TIME", "TIMESTAMP", "TIMESTAMPTZ", "INTERVAL"]);
const BOOLEAN = new Set(["BOOL", "BOOLEAN"]);

/**
 * PostgreSQL type declaration -> one of Spider's five categories.
 * Unknown names, including user-defined ENUM types, fall to `others`.
 */
export function mapType(declaration) {
  if (typeof declaration !== "string") return "others";
  const text = declaration.trim().toUpperCase();
  if (text.endsWith("]")) return "others"; // array suffix

  const head = text.split(/[\s(]/)[0];
  if (NUMBER.has(head)) return "number";
  if (TEXT.has(head)) return "text";
  if (TIME.has(head)) return "time";
  if (BOOLEAN.has(head)) return "boolean";
  return "others";
}

// ---------------------------------------------------------------------------
// Reading the generated DDL
// ---------------------------------------------------------------------------

const CONSTRAINT_WORDS = new Set([
  "PRIMARY", "FOREIGN", "UNIQUE", "CONSTRAINT", "CHECK", "EXCLUDE", "LIKE",
]);

function matchingParen(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  parts.push(current);
  return parts;
}

const key = (fk) => `${fk.from.table}.${fk.from.column}->${fk.to.table}.${fk.to.column}`;

/**
 * AMENDMENT (see header): tables and columns as `parseSchema` reads them, plus
 * the column types and foreign keys the scorer needs and `parseSchema` does not
 * return.
 *
 * @param {string} ddl
 * @returns {{tables: Map<string, Map<string, string>>, foreignKeys: object[]}}
 *          table -> (column -> Spider type category)
 */
export function readGeneratedSchema(ddl) {
  const tables = new Map();
  const foreignKeys = [];
  const seen = new Set();
  if (typeof ddl !== "string") return { tables, foreignKeys };

  const addFk = (fromTable, fromCol, toTable, toCol) => {
    const fk = {
      from: { table: fromTable.toLowerCase(), column: fromCol.toLowerCase() },
      to: { table: toTable.toLowerCase(), column: toCol.toLowerCase() },
    };
    // The same relationship is often declared twice, inline and again as a
    // table constraint. Counting it twice would inflate both precision and
    // recall denominators.
    if (seen.has(key(fk))) return;
    seen.add(key(fk));
    foreignKeys.push(fk);
  };

  const header = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([A-Za-z_]\w*)"?\s*\(/gi;
  let match;
  while ((match = header.exec(ddl)) !== null) {
    const table = match[1].toLowerCase();
    const open = ddl.indexOf("(", match.index + match[0].length - 1);
    const close = matchingParen(ddl, open);
    if (close === -1) continue;

    const columns = new Map();
    for (const part of splitTopLevel(ddl.slice(open + 1, close))) {
      const definition = part.trim();
      if (definition === "") continue;
      const first = definition.match(/^"?([A-Za-z_]\w*)"?/);
      if (!first) continue;
      const word = first[1].toUpperCase();

      if (CONSTRAINT_WORDS.has(word)) {
        const tableFk = definition.match(
          /FOREIGN\s+KEY\s*\(\s*"?([A-Za-z_]\w*)"?[^)]*\)\s*REFERENCES\s+"?([A-Za-z_]\w*)"?\s*\(\s*"?([A-Za-z_]\w*)"?/i
        );
        if (tableFk) addFk(table, tableFk[1], tableFk[2], tableFk[3]);
        continue;
      }

      const column = first[1].toLowerCase();
      const rest = definition.slice(first[0].length).trim();
      // The type is everything up to the first constraint keyword.
      const type = rest.split(/\s+(?=NOT\s|NULL\b|UNIQUE\b|PRIMARY\b|DEFAULT\b|REFERENCES\b|CHECK\b|GENERATED\b)/i)[0];
      columns.set(column, mapType(type));

      const inlineFk = rest.match(/REFERENCES\s+"?([A-Za-z_]\w*)"?\s*\(\s*"?([A-Za-z_]\w*)"?/i);
      if (inlineFk) addFk(table, column, inlineFk[1], inlineFk[2]);
    }
    tables.set(table, columns);
    header.lastIndex = close;
  }

  // Foreign keys added after the fact.
  const altered = /ALTER\s+TABLE\s+"?([A-Za-z_]\w*)"?[\s\S]*?FOREIGN\s+KEY\s*\(\s*"?([A-Za-z_]\w*)"?[^)]*\)\s*REFERENCES\s+"?([A-Za-z_]\w*)"?\s*\(\s*"?([A-Za-z_]\w*)"?/gi;
  let alter;
  while ((alter = altered.exec(ddl)) !== null) addFk(alter[1], alter[2], alter[3], alter[4]);

  return { tables, foreignKeys };
}

// ---------------------------------------------------------------------------
// Reading the gold standard — specification item 4
// ---------------------------------------------------------------------------

/**
 * One entry of Spider's tables.json -> the same shape readGeneratedSchema
 * returns, so the scorer compares like with like.
 */
export function goldSchema(entry) {
  const tableNames = entry.table_names_original.map((t) => t.toLowerCase());
  const tables = new Map(tableNames.map((t) => [t, new Map()]));

  // column_names_original[i] is [tableIndex, columnName]; index 0 is the
  // synthetic "*" column, excluded by specification item 4.
  entry.column_names_original.forEach(([tableIndex, column], i) => {
    if (tableIndex < 0) return;
    tables.get(tableNames[tableIndex]).set(column.toLowerCase(), entry.column_types[i]);
  });

  const columnRef = (i) => ({
    table: tableNames[entry.column_names_original[i][0]],
    column: entry.column_names_original[i][1].toLowerCase(),
  });

  const foreignKeys = (entry.foreign_keys ?? []).map(([from, to]) => ({
    from: columnRef(from),
    to: columnRef(to),
  }));

  return { tables, foreignKeys };
}

// ---------------------------------------------------------------------------
// Aggregation — specification item 7, and what belongs in the denominator
// ---------------------------------------------------------------------------

/**
 * Macro aggregate: per instance, then averaged unweighted.
 *
 * The denominator is the point of this function. An instance that answered but
 * produced nothing the harness could use still counts against recall, because
 * excluding it would report the average of the instances that happened to work
 * and call that a reliability figure. Precision over zero generated elements is
 * undefined, so those instances are excluded from precision only.
 *
 * An instance where the endpoint never answered is excluded from both. That is
 * an infrastructure failure rather than a defect in the model's output, and the
 * same rule keeps the reflection loop's convergence rate honest.
 *
 * @param {Array<{responded: boolean, [k: string]: any}>} records
 * @param {"exact"|"normalised"} matching
 */
export function aggregateScores(records, matching) {
  const answered = records.filter((r) => r.responded);
  const scored = answered.filter((r) => r[matching]);
  const unusable = answered.filter((r) => !r[matching]);

  const macro = {};
  for (const facet of ["tables", "columns", "foreignKeys"]) {
    const precisions = scored.map((r) => r[matching][facet].precision).filter((v) => v !== null);
    macro[`${facet}.precision`] = precisions.length
      ? precisions.reduce((a, b) => a + b, 0) / precisions.length
      : null;

    // Every answered instance contributes a recall, and an unusable one
    // contributes zero.
    const recalls = scored
      .map((r) => r[matching][facet].recall)
      .filter((v) => v !== null)
      .concat(unusable.map(() => 0));
    macro[`${facet}.recall`] = recalls.length
      ? recalls.reduce((a, b) => a + b, 0) / recalls.length
      : null;
  }

  // Micro is pooled over instances that produced a schema. An unusable instance
  // contributes no elements to pool, so it cannot be represented here the way it
  // is in macro. That asymmetry is why macro is the pre-registered headline and
  // micro is reported beside it rather than instead of it.
  const micro = {};
  for (const facet of ["tables", "columns", "foreignKeys"]) {
    const matched = scored.reduce((a, r) => a + r[matching][facet].matched, 0);
    const generated = scored.reduce((a, r) => a + r[matching][facet].generated, 0);
    const gold = scored.reduce((a, r) => a + r[matching][facet].gold, 0);
    micro[`${facet}.precision`] = generated ? matched / generated : null;
    micro[`${facet}.recall`] = gold ? matched / gold : null;
  }

  const typeMatched = scored.reduce((a, r) => a + r[matching].types.matched, 0);
  const typeCorrect = scored.reduce((a, r) => a + r[matching].types.correct, 0);

  return {
    macro,
    micro,
    scored: scored.length,
    unusable: unusable.length,
    noResponse: records.length - answered.length,
    typeAccuracyMicro: typeMatched ? typeCorrect / typeMatched : null,
  };
}

// ---------------------------------------------------------------------------
// Matching — specification items 5 and 6
// ---------------------------------------------------------------------------

function normalise(name, matching) {
  const lower = String(name).toLowerCase();
  if (matching === "exact") return lower;
  const flat = lower.replace(/_/g, "");
  return flat.replace(/(?:es|s)$/, "");
}

// Builds gold name -> generated name for whatever matched, first match wins so
// two generated tables cannot both claim one gold table.
function pair(goldNames, generatedNames, matching) {
  const taken = new Set();
  const pairs = new Map();
  for (const goldName of goldNames) {
    const target = normalise(goldName, matching);
    for (const generatedName of generatedNames) {
      if (taken.has(generatedName)) continue;
      if (normalise(generatedName, matching) !== target) continue;
      pairs.set(goldName, generatedName);
      taken.add(generatedName);
      break;
    }
  }
  return pairs;
}

const ratio = (matched, total) => (total === 0 ? null : matched / total);

/**
 * @param {object} gold        from goldSchema()
 * @param {object} generated   from readGeneratedSchema()
 * @param {{matching: "exact"|"normalised"}} options
 */
export function scoreInstance(gold, generated, { matching }) {
  const goldTables = [...gold.tables.keys()];
  const generatedTables = [...generated.tables.keys()];
  const tablePairs = pair(goldTables, generatedTables, matching);

  let goldColumns = 0;
  let generatedColumns = 0;
  let matchedColumns = 0;
  let correctTypes = 0;
  const columnPairs = new Map();

  for (const columns of gold.tables.values()) goldColumns += columns.size;
  for (const columns of generated.tables.values()) generatedColumns += columns.size;

  for (const [goldTable, generatedTable] of tablePairs) {
    const goldCols = gold.tables.get(goldTable);
    const generatedCols = generated.tables.get(generatedTable);
    const pairs = pair([...goldCols.keys()], [...generatedCols.keys()], matching);
    matchedColumns += pairs.size;
    columnPairs.set(goldTable, pairs);
    for (const [goldCol, generatedCol] of pairs) {
      if (goldCols.get(goldCol) === generatedCols.get(generatedCol)) correctTypes += 1;
    }
  }

  // Specification item 8: both endpoints must match, and the direction must
  // agree. Endpoints are compared through the table and column pairings already
  // established, so a foreign key can only match between matched tables.
  const resolved = new Set();
  for (const [goldTable, generatedTable] of tablePairs) {
    for (const [goldCol, generatedCol] of columnPairs.get(goldTable)) {
      resolved.add(`${goldTable}.${goldCol}=${generatedTable}.${generatedCol}`);
    }
  }
  const translate = (ref) => {
    const generatedTable = tablePairs.get(ref.table);
    if (!generatedTable) return null;
    const generatedCol = columnPairs.get(ref.table)?.get(ref.column);
    if (!generatedCol) return null;
    return `${generatedTable}.${generatedCol}`;
  };
  const generatedKeys = new Set(
    generated.foreignKeys.map((fk) => `${fk.from.table}.${fk.from.column}->${fk.to.table}.${fk.to.column}`)
  );
  let matchedFks = 0;
  for (const fk of gold.foreignKeys) {
    const from = translate(fk.from);
    const to = translate(fk.to);
    if (from && to && generatedKeys.has(`${from}->${to}`)) matchedFks += 1;
  }

  const empty = generatedTables.length === 0;

  return {
    empty,
    tables: {
      gold: goldTables.length,
      generated: generatedTables.length,
      matched: tablePairs.size,
      precision: ratio(tablePairs.size, generatedTables.length),
      recall: ratio(tablePairs.size, goldTables.length),
    },
    columns: {
      gold: goldColumns,
      generated: generatedColumns,
      matched: matchedColumns,
      precision: ratio(matchedColumns, generatedColumns),
      recall: ratio(matchedColumns, goldColumns),
    },
    foreignKeys: {
      gold: gold.foreignKeys.length,
      generated: generated.foreignKeys.length,
      matched: matchedFks,
      precision: ratio(matchedFks, generated.foreignKeys.length),
      recall: ratio(matchedFks, gold.foreignKeys.length),
    },
    types: {
      matched: matchedColumns,
      correct: correctTypes,
      accuracy: ratio(correctTypes, matchedColumns),
    },
  };
}
