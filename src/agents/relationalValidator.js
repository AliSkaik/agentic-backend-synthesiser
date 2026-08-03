// Agent 3 integrity verifier.
// Layer 2: does every column the routes reference actually exist in the schema?
//
// Contract: identical in shape to Layer 1 (`src/agents/integrityVerifier.js`).
// `passed: true` means THIS layer's check succeeded and nothing more. A module
// can satisfy Layer 2 and still be wrong: `v5-blog` references only real
// columns while reading a URL parameter out of the request body. The word
// `verified` remains reserved for an orchestrator that has run every layer.
//
// Scope. This layer answers soundness only "every referenced column exists".
// It deliberately does not answer completeness ("every table has routes"); see
// the note at the bottom of this file for why that is a separate layer.
//
// Input is the AST Layer 1 returned on success plus the DDL string Agent 1
// produced. It never re-parses the source, so Layer 1 must have passed first.

const LAYER = 2;

// Stands in for a `${...}` substitution inside a template literal. It is not an
// identifier character, so it cannot fuse with the static text either side of
// it and be mistaken for a column name.
const SUBSTITUTION = "?";

// Definition lines inside a CREATE TABLE body that declare a constraint rather
// than a column.
const CONSTRAINT_KEYWORDS = new Set([
  "PRIMARY",
  "FOREIGN",
  "UNIQUE",
  "CONSTRAINT",
  "CHECK",
  "EXCLUDE",
  "LIKE",
]);

// Bare words that can occupy a column-shaped position in SQL without being a
// column. CURRENT_TIMESTAMP is the one that actually occurs in Agent 2 output.
const NON_COLUMN_TOKENS = new Set([
  "CURRENT_TIMESTAMP",
  "CURRENT_DATE",
  "CURRENT_TIME",
  "NOW",
  "NULL",
  "TRUE",
  "FALSE",
  "DEFAULT",
  "AND",
  "OR",
  "NOT",
  "IS",
  "IN",
  "LIKE",
  "BETWEEN",
]);

// ---------------------------------------------------------------------------
// Step 1 the schema's ground truth
// ---------------------------------------------------------------------------

// Returns the index just past the `)` matching the `(` at `open`, or -1.
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

// Splits a CREATE TABLE body on the commas that separate definitions, ignoring
// commas nested inside parentheses (NUMERIC(10, 2), CHECK (...), PRIMARY KEY
// (a, b)).
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
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

/**
 * Builds table name -> Set of column names from a DDL string.
 *
 * This is a lexical scan, not a SQL parser. See "Known shortcut" at the bottom
 * of this file for exactly what it does not understand.
 */
export function parseSchema(ddl) {
  const schema = new Map();
  if (typeof ddl !== "string") return schema;

  const header = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([A-Za-z_]\w*)"?\s*\(/gi;
  let match;
  while ((match = header.exec(ddl)) !== null) {
    const table = match[1].toLowerCase();
    const open = ddl.indexOf("(", match.index + match[0].length - 1);
    const close = matchingParen(ddl, open);
    if (close === -1) continue;

    const columns = new Set();
    for (const part of splitTopLevel(ddl.slice(open + 1, close))) {
      const definition = part.trim();
      if (definition === "") continue;
      const first = definition.match(/^"?([A-Za-z_]\w*)"?/);
      if (!first) continue;
      if (CONSTRAINT_KEYWORDS.has(first[1].toUpperCase())) continue;
      columns.add(first[1].toLowerCase());
    }
    schema.set(table, columns);

    // Resume after this block so a nested `CREATE TABLE` in a comment or string
    // inside the body cannot be picked up twice.
    header.lastIndex = close;
  }
  return schema;
}

// ---------------------------------------------------------------------------
// Step 2 what the routes actually reference
// ---------------------------------------------------------------------------

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "all"]);

function isPoolQuery(node) {
  const callee = node.callee;
  return (
    callee?.type === "MemberExpression" &&
    callee.object?.type === "Identifier" &&
    callee.object.name === "pool" &&
    callee.property?.type === "Identifier" &&
    callee.property.name === "query"
  );
}

// `router.get("/customers/:id", handler)` -> "GET /customers/:id"
function routeLabel(node) {
  const callee = node.callee;
  if (
    callee?.type !== "MemberExpression" ||
    callee.property?.type !== "Identifier" ||
    !HTTP_METHODS.has(callee.property.name)
  ) {
    return null;
  }
  const first = node.arguments?.[0];
  if (first?.type !== "Literal" || typeof first.value !== "string") return null;
  return `${callee.property.name.toUpperCase()} ${first.value}`;
}

// Recovers the static text of a SQL argument. A template literal's `${...}`
// expressions are not statically known, so each is replaced by a placeholder
// and only the surrounding literal text is analysed.
function staticText(node) {
  if (node?.type === "Literal" && typeof node.value === "string") {
    return { sql: node.value, interpolated: false };
  }
  if (node?.type === "TemplateLiteral") {
    return {
      sql: node.quasis.map((q) => q.value.cooked ?? "").join(SUBSTITUTION),
      interpolated: node.expressions.length > 0,
    };
  }
  return null;
}

/**
 * Walks the AST and returns every SQL string handed to pool.query, tagged with
 * the route it sits inside and its source line.
 */
export function collectQueries(ast) {
  const found = [];

  const visit = (node, route) => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child, route);
      return;
    }
    if (typeof node.type !== "string") return;

    let scope = route;
    if (node.type === "CallExpression") {
      scope = routeLabel(node) ?? scope;
      if (isPoolQuery(node)) {
        const text = staticText(node.arguments?.[0]);
        if (text) {
          found.push({
            sql: text.sql,
            interpolated: text.interpolated,
            route: scope ?? "module scope",
            line: node.arguments[0].loc?.start.line ?? null,
          });
        }
      }
    }

    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "range" || key === "start" || key === "end") continue;
      visit(node[key], scope);
    }
  };

  visit(ast, null);
  return found;
}

// Which table a single-table statement targets, or null when the statement
// draws on more than one table and a column therefore cannot be attributed to
// one of them by position alone.
function targetTable(sql) {
  if (/\bJOIN\b/i.test(sql)) return null;
  if (/\(\s*SELECT\b/i.test(sql)) return null; // subquery: two tables in scope

  // Every point where a table is named. More than one means the names in this
  // statement belong to different tables and cannot be told apart lexically.
  const sources = sql.match(/\b(?:FROM|INSERT\s+INTO|UPDATE)\s+"?[A-Za-z_]\w*"?/gi) ?? [];
  if (sources.length !== 1) return null;

  const from = sql.match(/\bFROM\s+"?([A-Za-z_]\w*)"?\s*(,)?/i);
  if (from && from[2]) return null; // comma-separated FROM list
  const insert = sql.match(/\bINSERT\s+INTO\s+"?([A-Za-z_]\w*)"?/i);
  if (insert) return insert[1].toLowerCase();
  const update = sql.match(/\bUPDATE\s+"?([A-Za-z_]\w*)"?/i);
  if (update) return update[1].toLowerCase();
  if (from) return from[1].toLowerCase();
  return null;
}

function addName(into, raw) {
  const name = raw.trim().replace(/^"|"$/g, "");
  if (!/^[A-Za-z_]\w*$/.test(name)) return;
  if (NON_COLUMN_TOKENS.has(name.toUpperCase())) return;
  into.add(name.toLowerCase());
}

/**
 * Extracts the names occupying a column position in one SQL statement: the
 * INSERT column list, the left-hand side of each assignment in an UPDATE SET
 * clause, and the names being compared in a WHERE clause.
 *
 * Request-body field names are deliberately out of scope they need not match
 * column names. This mirrors the check used by hand on Agent 2's v4 output.
 */
export function extractColumns(rawSql) {
  const sql = rawSql.replace(/\s+/g, " ");
  const columns = new Set();

  const insert = sql.match(/\bINSERT\s+INTO\s+"?[A-Za-z_]\w*"?\s*\(([^)]*)\)/i);
  if (insert) {
    for (const name of splitTopLevel(insert[1])) addName(columns, name);
  }

  const set = sql.match(/\bSET\b(.*?)(?=\bWHERE\b|\bRETURNING\b|$)/i);
  if (set) {
    for (const assignment of splitTopLevel(set[1])) {
      const eq = assignment.indexOf("=");
      if (eq === -1) continue;
      addName(columns, assignment.slice(0, eq));
    }
  }

  const where = sql.match(
    /\bWHERE\b(.*?)(?=\bRETURNING\b|\bORDER\s+BY\b|\bGROUP\s+BY\b|\bLIMIT\b|$)/i
  );
  if (where) {
    const comparison = /"?([A-Za-z_]\w*)"?\s*(?:=|<>|!=|>=|<=|>|<|\bLIKE\b|\bILIKE\b|\bIS\b|\bIN\b)/gi;
    let hit;
    while ((hit = comparison.exec(where[1])) !== null) addName(columns, hit[1]);
  }

  return columns;
}

// ---------------------------------------------------------------------------
// Step 3 the assertion
// ---------------------------------------------------------------------------

function feedbackFor(violations, schema) {
  const lines = [
    `Layer ${LAYER} (schema): the routes reference ${violations.length === 1 ? "a column that does" : "columns that do"} not exist in the schema.`,
    "",
  ];
  for (const v of violations) {
    const known = schema.get(v.table);
    lines.push(
      `- Column "${v.columnName}" in route ${v.route}` +
        (v.line === null ? "" : ` (line ${v.line})`) +
        (v.table === null
          ? " does not exist in any table in the schema."
          : `: table "${v.table}" has no such column. Its columns are: ${[...known].join(", ")}.`)
    );
  }
  lines.push(
    "",
    "Every column named in a SQL statement must be declared in the DDL you were",
    "given. Do not invent columns. Return the complete module again, using only",
    "the declared columns."
  );
  return lines.join("\n");
}

/**
 * @param {object} ast  the AST Layer 1 returned on success
 * @param {string} ddl  the DDL Agent 1 produced
 * @returns {{passed: boolean, layer: number, error?: object, feedback?: string}}
 */
export function validateRelations(ast, ddl) {
  const schema = parseSchema(ddl);

  if (schema.size === 0) {
    // No ground truth means no assertion is possible. Reporting a pass here
    // would be the false pass this component exists to prevent, so this is a
    // failure of the check itself and is typed differently from a real
    // violation so a driver can tell them apart.
    return {
      passed: false,
      layer: LAYER,
      error: {
        type: "NoSchema",
        message: "No CREATE TABLE statements found in the DDL; cannot validate columns",
        line: null,
        violations: [],
      },
      feedback: `Layer ${LAYER} (schema): no tables could be read from the DDL, so the routes could not be checked against it.`,
    };
  }

  const everyColumn = new Set();
  for (const columns of schema.values()) {
    for (const column of columns) everyColumn.add(column);
  }

  const violations = [];
  for (const query of collectQueries(ast)) {
    const table = targetTable(query.sql);
    // Per-table when the target is known, union-of-all-columns when it is not.
    const known = table !== null && schema.has(table) ? schema.get(table) : everyColumn;
    const scope = table !== null && schema.has(table) ? table : null;

    for (const columnName of extractColumns(query.sql)) {
      if (known.has(columnName)) continue;
      violations.push({ columnName, table: scope, route: query.route, line: query.line });
    }
  }

  if (violations.length === 0) return { passed: true, layer: LAYER };

  return {
    passed: false,
    layer: LAYER,
    error: {
      type: "UnknownColumn",
      message:
        violations.length === 1
          ? `Column "${violations[0].columnName}" does not exist in table "${violations[0].table}"`
          : `${violations.length} referenced columns do not exist in the schema`,
      line: violations[0].line,
      violations,
    },
    feedback: feedbackFor(violations, schema),
  };
}

// ---------------------------------------------------------------------------
// Design notes
// ---------------------------------------------------------------------------
//
// Matching is PER TABLE, not against the union of every column in the schema.
//
//   The union is too permissive on exactly the schemas this project generates.
//   In the orders fixture `customer_id` is declared on both `customers` and
//   `orders`, and `order_id` on both `orders` and `order_line_items`. Under a
//   union check, `UPDATE order_line_items SET customer_id = $1` an assignment
//   Postgres would reject passes, because the name exists somewhere. Per-table
//   matching is the assertion the database will actually make at runtime, and
//   Layer 2 is only worth building if it predicts that.
//
//   It is also cheap here. Agent 2 emits single-table statements exclusively:
//   the target is whatever follows INSERT INTO, UPDATE, or FROM. There is no
//   alias resolution to do because there are no aliases and no joins.
//
//   Where the target genuinely cannot be determined (a JOIN, a multi-table
//   FROM), the check falls back to the union rather than guessing. That
//   direction is chosen deliberately: a false failure would push Agent 2 into a
//   repair loop on correct code, at ~200 s per regeneration, and would teach it
//   to "fix" something that was never broken. A miss costs one undetected
//   defect. Given the cost asymmetry, the weaker verdict is the safer one to
//   return when the statement is not understood and the fallback is recorded
//   in the result as `table: null` so it is visible rather than silent.
//
// COMPLETENESS ("every table has routes") is NOT owned by this layer.
//
//   Soundness and completeness fail in different directions and cannot share a
//   gate. A soundness failure means the code is definitely broken: Postgres
//   will raise `column ... does not exist` on the first request. A completeness
//   failure means something may be missing and Agent 2's own prompt makes
//   absence legitimate, since a junction table is explicitly not a resource and
//   gets nested routes under its owner instead. A gate that blocks on
//   completeness would reject correct output for obeying its instructions.
//
//   The feedback also points the opposite way. Soundness names a defect to
//   remove and is directly actionable. Completeness names work to add, which is
//   a coverage measurement, better scored than gated at least until junction
//   tables and other legitimate exemptions can be recognised reliably.
//
//   So completeness belongs to a later layer (coverage), reporting a score
//   rather than a pass/fail. Keeping it out preserves what `passed` means here:
//   nothing referenced is wrong, not nothing is missing.
//
// KNOWN SHORTCUT the DDL reader is a lexical scan, not a SQL parser.
//
//   It finds CREATE TABLE blocks by regex, matches parentheses by counting, and
//   takes the first identifier of each top-level definition as a column name.
//   It therefore does not understand: ALTER TABLE ... ADD COLUMN, quoted
//   identifiers containing spaces or punctuation, columns added by inheritance
//   or LIKE, views, or a CREATE TABLE appearing inside a string literal or
//   comment. It does correctly skip CREATE TYPE ... AS ENUM blocks, which occur
//   in both current fixtures, because it anchors on CREATE TABLE.
//
//   Consequence if a column is missed, the schema map is too small and a valid
//   column is reported as invented a false failure. This is the more expensive
//   error direction, which is why it is recorded here rather than left implicit.
//
// KNOWN GAP dynamically built column lists are invisible to this layer.
//
//   Agent 2 builds INSERT and UPDATE column lists from a JavaScript `allowed`
//   array: `INSERT INTO customers (${cols.join(", ")})`. Only the static text of
//   a template literal is analysed, so those column names never reach this
//   check. An invented column that appears only in an `allowed` array passes
//   Layer 2 today. Reading array literals assigned to `allowed` would close it
//   and is the obvious next assertion for this layer.
