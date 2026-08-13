// Agent 3 integrity verifier.
// Layer 0: is Agent 1's DDL well formed under the grammar the thesis publishes?
//
// Contract: identical in shape to Layers 1 and 2. `passed: true` means THIS
// layer's check succeeded and nothing more. The word `verified` is reserved for
// the orchestrator that has run every layer.
//
// This layer exists because nothing validated Agent 1's output at all. Layer 1
// parses JavaScript; Layer 2 reads the DDL lexically but assumes it is well
// formed, and Week 7 limitation 1 records that Agent 1 can leak prose.
//
// The parser is recursive descent with an explicit parenthesis stack. That
// stack is the justification for a context-free rather than a regular grammar:
// a regular grammar cannot count nested delimiters, so `NUMERIC(10, 2)` inside
// a column list inside a table body is exactly the construct that puts this
// beyond a regex.

const LAYER = 0;

// ---------------------------------------------------------------------------
// Tokeniser
// ---------------------------------------------------------------------------

// "[" and "]" carry the array suffix, `TEXT[]`. They are punctuation rather
// than operators so the array parser can match them exactly.
// "." carries qualified names and composite field access, `amount.amount`.
// Checked before the number branch, but a number starting with a digit consumes
// its own decimal point, so `NUMERIC(19, 4)` is unaffected.
//
// Tokenising "." is deliberately NOT the same as parsing qualified names. A
// schema-qualified `REFERENCES public.accounts(id)` still fails, because Layer 2
// reads an unqualified table name out of the same DDL and the two readers must
// agree; teaching only one of them about qualification would break the
// agreement that tests/layer0.test.js asserts. Recorded as a limitation.
const PUNCTUATION = new Set(["(", ")", ",", ";", "[", "]", "."]);

// Comparison and arithmetic characters, plus ":" for the `0::NUMERIC` cast.
// Runs of them merge into one token, so "::" arrives whole. They occur inside
// CHECK expressions and cast suffixes, neither of which is parsed as an
// expression see parseBalanced.
const OPERATOR = new Set(["<", ">", "=", "!", "+", "-", "*", "/", "%", "|", ":"]);

/**
 * Produces {type, value, line, column} tokens. Column is 0-based to match the
 * convention Acorn uses in Layer 1, so the shared caret renderer lines up.
 *
 * @param {string} source
 * @returns {{tokens: object[], error: object|null}}
 */
export function tokenise(source) {
  const tokens = [];
  let line = 1;
  let column = 0;
  let i = 0;

  const push = (type, value, startLine, startColumn) =>
    tokens.push({ type, value, line: startLine, column: startColumn });

  while (i < source.length) {
    const ch = source[i];

    if (ch === "\n") {
      line += 1;
      column = 0;
      i += 1;
      continue;
    }

    if (/\s/.test(ch)) {
      i += 1;
      column += 1;
      continue;
    }

    // `-- comment to end of line`
    if (ch === "-" && source[i + 1] === "-") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }

    if (PUNCTUATION.has(ch)) {
      push("punctuation", ch, line, column);
      i += 1;
      column += 1;
      continue;
    }

    if (OPERATOR.has(ch)) {
      const startColumn = column;
      let value = "";
      while (i < source.length && OPERATOR.has(source[i])) {
        value += source[i];
        i += 1;
        column += 1;
      }
      push("operator", value, line, startColumn);
      continue;
    }

    // Dollar-quoted string, $$...$$ or $tag$...$tag$. Function bodies arrive
    // this way and contain semicolons, so the whole body must become one token
    // or every statement boundary after it is wrong.
    if (ch === "$") {
      const startLine = line;
      const startColumn = column;
      const tag = source.slice(i).match(/^\$[A-Za-z_]\w*\$|^\$\$/);
      if (!tag) {
        return {
          tokens,
          error: {
            type: "UnexpectedToken",
            message: 'Unexpected character "$"',
            line,
            column,
          },
        };
      }
      const close = source.indexOf(tag[0], i + tag[0].length);
      if (close === -1) {
        return {
          tokens,
          error: {
            type: "UnexpectedToken",
            message: `Unterminated dollar-quoted string opened with ${tag[0]}`,
            line: startLine,
            column: startColumn,
          },
        };
      }
      const body = source.slice(i, close + tag[0].length);
      for (const c of body) {
        if (c === "\n") {
          line += 1;
          column = 0;
        } else column += 1;
      }
      i = close + tag[0].length;
      push("string", body, startLine, startColumn);
      continue;
    }

    // Single-quoted literal. Agent 1 emits these in DEFAULT and ENUM clauses.
    if (ch === "'") {
      const startLine = line;
      const startColumn = column;
      let value = "";
      i += 1;
      column += 1;
      while (i < source.length && source[i] !== "'") {
        if (source[i] === "\n") {
          line += 1;
          column = 0;
        } else {
          column += 1;
        }
        value += source[i];
        i += 1;
      }
      if (i >= source.length) {
        return {
          tokens,
          error: {
            type: "UnexpectedToken",
            message: "Unterminated string literal",
            line: startLine,
            column: startColumn,
          },
        };
      }
      i += 1;
      column += 1;
      push("string", value, startLine, startColumn);
      continue;
    }

    if (/[0-9]/.test(ch)) {
      const startColumn = column;
      let value = "";
      while (i < source.length && /[0-9.]/.test(source[i])) {
        value += source[i];
        i += 1;
        column += 1;
      }
      push("number", value, line, startColumn);
      continue;
    }

    // Identifiers, optionally double-quoted. Keywords are identifiers at this
    // stage; the parser decides what a word means from its position, which is
    // what keeps the tokeniser free of the grammar's vocabulary.
    if (/[A-Za-z_"]/.test(ch)) {
      const startColumn = column;
      const quoted = ch === '"';
      let value = "";
      if (quoted) {
        i += 1;
        column += 1;
        while (i < source.length && source[i] !== '"') {
          value += source[i];
          i += 1;
          column += 1;
        }
        i += 1;
        column += 1;
      } else {
        while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) {
          value += source[i];
          i += 1;
          column += 1;
        }
      }
      push("identifier", value, line, startColumn);
      continue;
    }

    return {
      tokens,
      error: {
        type: "UnexpectedToken",
        message: `Unexpected character "${ch}"`,
        line,
        column,
      },
    };
  }

  push("eof", null, line, column);
  return { tokens, error: null };
}

// ---------------------------------------------------------------------------
// Feedback rendering — the same caret excerpt Layer 1 produces
// ---------------------------------------------------------------------------

function excerpt(source, line, column) {
  const text = source.split("\n")[line - 1] ?? "";
  const gutter = String(line);
  return (
    `  ${gutter} | ${text}\n` +
    `  ${" ".repeat(gutter.length)} | ${" ".repeat(Math.max(column, 0))}^`
  );
}

function feedbackFor(error, source) {
  return [
    `Layer ${LAYER} (grammar): the schema you returned is not well-formed DDL.`,
    `${error.message} at line ${error.line}, column ${error.column}:`,
    "",
    excerpt(source, error.line, error.column),
    "",
    "Return the complete schema again, corrected. Emit only CREATE statements:",
    "no prose, no explanation, no markdown fences.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

class Parser {
  constructor(tokens, extended = false) {
    this.tokens = tokens;
    this.extended = extended;
    this.position = 0;
    // The context-free part. Every "(" pushes its token, every ")" pops and
    // checks. An unbalanced script is detected by inspecting what is left.
    this.parens = [];
    // table -> Set of column names, in the same shape and the same casing as
    // Layer 2's parseSchema. Built structurally rather than lexically, and
    // asserted equal to Layer 2's reading in tests/layer0.test.js.
    this.schema = new Map();
    this.currentTable = null;
  }

  peek(offset = 0) {
    return this.tokens[this.position + offset] ?? this.tokens[this.tokens.length - 1];
  }

  next() {
    const token = this.peek();
    if (token.type !== "eof") this.position += 1;
    return token;
  }

  atEof() {
    return this.peek().type === "eof";
  }

  // Case-insensitive keyword match on an identifier token.
  isWord(word, offset = 0) {
    const token = this.peek(offset);
    return token.type === "identifier" && token.value.toUpperCase() === word;
  }

  isPunctuation(value, offset = 0) {
    const token = this.peek(offset);
    return token.type === "punctuation" && token.value === value;
  }

  fail(type, message, token = this.peek()) {
    return {
      type,
      message,
      line: token.line,
      column: token.column,
    };
  }

  expectPunctuation(value, message) {
    if (!this.isPunctuation(value)) {
      const type = value === ";" ? "MissingSemicolon" : "UnexpectedToken";
      return this.fail(type, message);
    }
    const token = this.next();
    if (value === "(") this.parens.push(token);
    if (value === ")") this.parens.pop();
    return null;
  }
}

// <ddl_script> ::= <create_table_stmt> { <create_table_stmt> }
function parseScript(parser) {
  if (parser.atEof()) {
    return parser.fail("UnexpectedToken", "No statements found");
  }

  while (!parser.atEof()) {
    // The extended grammar admits CREATE TYPE ... AS ENUM, which both real
    // fixtures open with. The published grammar has no production for it, so
    // under `published` this falls through to parseCreateTable and fails there
    // which is the correct verdict, not a gap in this function.
    const error = parser.extended ? parseStatement(parser) : parseCreateTable(parser);
    if (error) return error;
  }
  return null;
}

// EXTENDED ONLY. Dispatch on the statement kind. The published grammar has one
// production, <create_table_stmt>, so under `published` everything here falls
// through to parseCreateTable and fails there which is the correct verdict,
// not a gap in this function.
function parseStatement(parser) {
  if (parser.isWord("CREATE")) {
    if (parser.isWord("TYPE", 1)) return parseCreateType(parser);
    if (parser.isWord("DOMAIN", 1)) return parseCreateDomain(parser);
    if (parser.isWord("INDEX", 1)) return parseCreateIndex(parser);
    if (parser.isWord("UNIQUE", 1) && parser.isWord("INDEX", 2)) return parseCreateIndex(parser);
    if (parser.isWord("VIEW", 1)) return parseCreateView(parser);
    if (parser.isWord("FUNCTION", 1)) return parseCreateFunction(parser);
    if (parser.isWord("OR", 1) && parser.isWord("REPLACE", 2)) {
      if (parser.isWord("FUNCTION", 3)) return parseCreateFunction(parser);
      return parseCreateView(parser);
    }
  }
  if (parser.isWord("ALTER") && parser.isWord("TABLE", 1)) return parseAlterTable(parser);
  return parseCreateTable(parser);
}

// EXTENDED ONLY. Added 2026-08-12 after the Spider smoke test rejected valid
// output on an independent sample. ALTER TABLE is named in Agent 1's own system
// prompt as permitted output, so rejecting it was a false failure against the
// artefact's own specification.
//
// <alter_table_stmt> ::= "ALTER TABLE" <table_name> <action> { "," <action> } ";"
//
// The action is validated for its leading verb and then consumed as a balanced
// token run to the terminating semicolon, the same treatment <balanced_group>
// receives elsewhere. Requiring the verb is what stops this becoming a
// skip-to-semicolon rule that would accept anything.
const ALTER_ACTIONS = new Set(["ADD", "DROP", "ALTER", "RENAME", "SET", "OWNER", "VALIDATE"]);

function parseAlterTable(parser) {
  parser.next(); // ALTER
  parser.next(); // TABLE
  if (parser.isWord("ONLY")) parser.next();

  if (parser.peek().type !== "identifier") {
    return parser.fail("UnexpectedToken", "Expected a table name after ALTER TABLE");
  }
  parser.next();

  if (!(parser.peek().type === "identifier" && ALTER_ACTIONS.has(parser.peek().value.toUpperCase()))) {
    return parser.fail(
      "UnexpectedToken",
      `Expected ADD, DROP, ALTER, RENAME or SET after the table name, found "${parser.peek().value ?? "end of input"}"`
    );
  }

  return consumeToSemicolon(parser, "Expected ; after the ALTER TABLE statement");
}

// EXTENDED ONLY. A view's body is an arbitrary SELECT, which this grammar does
// not specify and deliberately does not parse the same limit stated for CHECK
// predicates. The header is validated; the query is consumed balance-aware.
function parseCreateView(parser) {
  parser.next(); // CREATE
  if (parser.isWord("OR")) {
    parser.next();
    parser.next(); // REPLACE
  }
  parser.next(); // VIEW

  if (parser.peek().type !== "identifier") {
    return parser.fail("UnexpectedToken", "Expected a view name after CREATE VIEW");
  }
  parser.next();

  if (parser.isPunctuation("(")) {
    const error = parseBalanced(parser, "Expected ( listing the view columns");
    if (error) return error;
  }

  if (!parser.isWord("AS")) {
    return parser.fail("UnexpectedToken", "Expected AS after the view name");
  }
  parser.next();

  if (!parser.isWord("SELECT") && !parser.isWord("WITH")) {
    return parser.fail("UnexpectedToken", "Expected a SELECT query after AS");
  }

  return consumeToSemicolon(parser, "Expected ; after the CREATE VIEW statement");
}

// EXTENDED ONLY. Added after the 100-instance Spider run, where 13 schemas
// carried a stored function alongside their tables.
//
// <create_function_stmt> ::= "CREATE" [ "OR REPLACE" ] "FUNCTION" <name>
//                            "(" [ <args> ] ")" "RETURNS" <data_type>
//                            "AS" <dollar_quoted_body> { <option> } ";"
//
// The body is a dollar-quoted string and is one token by the time it arrives
// here, so the semicolons inside it cannot be mistaken for statement ends. Its
// contents are procedural code in another language and are not parsed the same
// limit already stated for CHECK predicates and view queries.
function parseCreateFunction(parser) {
  parser.next(); // CREATE
  if (parser.isWord("OR")) {
    parser.next();
    parser.next(); // REPLACE
  }
  parser.next(); // FUNCTION

  if (parser.peek().type !== "identifier") {
    return parser.fail("UnexpectedToken", "Expected a function name after CREATE FUNCTION");
  }
  parser.next();

  const error = parseBalanced(parser, "Expected ( listing the function arguments");
  if (error) return error;

  if (parser.isWord("RETURNS")) {
    parser.next();
    if (parser.isWord("TABLE")) {
      parser.next();
      const returnsTable = parseBalanced(parser, "Expected ( after RETURNS TABLE");
      if (returnsTable) return returnsTable;
    } else {
      const type = parseDataType(parser);
      if (type) return type;
    }
  }

  return consumeToSemicolon(parser, "Expected ; after the CREATE FUNCTION statement");
}

// Consumes tokens up to the statement's terminating semicolon, tracking
// parenthesis depth so a semicolon nested inside parentheses does not end it.
function consumeToSemicolon(parser, message) {
  for (;;) {
    if (parser.atEof()) return unclosedOr(parser, message);
    if (parser.isPunctuation("(")) {
      const error = parseBalanced(parser, "Expected (");
      if (error) return error;
      continue;
    }
    if (parser.isPunctuation(";")) return parser.expectPunctuation(";", message);
    parser.next();
  }
}

// EXTENDED ONLY.
// <create_domain_stmt> ::= "CREATE DOMAIN" <name> "AS" <data_type> { <constraint> } ";"
//
// Included because it is the construct Agent 1 was reaching for when it emitted
// `CREATE TYPE tag_name AS VARCHAR(255)` in the 2026-08-11 probe. Accepting the
// correct spelling is not the same as accepting the incorrect one, and
// parseCreateType below still rejects that.
function parseCreateDomain(parser) {
  parser.next(); // CREATE
  parser.next(); // DOMAIN

  if (parser.peek().type !== "identifier") {
    return parser.fail("UnexpectedToken", "Expected a domain name after CREATE DOMAIN");
  }
  parser.next();

  if (!parser.isWord("AS")) {
    return parser.fail("UnexpectedToken", "Expected AS after the domain name");
  }
  parser.next();

  let error = parseDataType(parser);
  if (error) return error;

  error = parseExtendedConstraints(parser);
  if (error) return error;

  return parser.expectPunctuation(";", "Expected ; after the CREATE DOMAIN statement");
}

// EXTENDED ONLY.
// <create_index_stmt> ::= "CREATE" [ "UNIQUE" ] "INDEX" [ <name> ] "ON" <table_name>
//                         [ "USING" <method> ] "(" <expr_list> ")" ";"
//
// DECISION: indexes are PARSED, not skipped to the next semicolon.
//
//   Skipping is one line and would accept `CREATE INDEX idx ON d (id;` a
//   malformed statement passing the gate. That is a false pass, which is the
//   failure class this whole agent exists to prevent, and it would be reached
//   by the cheaper implementation rather than by any considered trade-off.
//   Parsing costs a dozen lines and keeps `passed: true` meaning what it says.
//   Recorded in the logbook alongside the coverage table.
function parseCreateIndex(parser) {
  parser.next(); // CREATE
  if (parser.isWord("UNIQUE")) parser.next();
  parser.next(); // INDEX

  if (parser.isWord("CONCURRENTLY")) parser.next();

  // The index name is optional: PostgreSQL will generate one.
  if (parser.peek().type === "identifier" && !parser.isWord("ON")) parser.next();

  if (!parser.isWord("ON")) {
    return parser.fail("UnexpectedToken", "Expected ON after the index name");
  }
  parser.next();

  if (parser.peek().type !== "identifier") {
    return parser.fail("UnexpectedToken", "Expected a table name after ON");
  }
  parser.next();

  if (parser.isWord("USING")) {
    parser.next();
    if (parser.peek().type !== "identifier") {
      return parser.fail("UnexpectedToken", "Expected an index method after USING");
    }
    parser.next();
  }

  const error = parseBalanced(parser, "Expected ( listing the indexed columns");
  if (error) return error;

  // A partial index: WHERE follows the column list.
  if (parser.isWord("WHERE")) {
    while (!parser.isPunctuation(";") && !parser.atEof()) parser.next();
  }

  return parser.expectPunctuation(";", "Expected ; after the CREATE INDEX statement");
}

// EXTENDED ONLY.
// <create_type_stmt> ::= "CREATE TYPE" <type_name> "AS ENUM" "(" <literal_list> ")" ";"
function parseCreateType(parser) {
  parser.next(); // CREATE
  parser.next(); // TYPE

  if (parser.peek().type !== "identifier") {
    return parser.fail("UnexpectedToken", "Expected a type name after CREATE TYPE");
  }
  parser.next();

  if (!parser.isWord("AS")) {
    return parser.fail("UnexpectedToken", "Expected AS after the type name");
  }
  parser.next();

  // PostgreSQL's CREATE TYPE has exactly three parenthesised forms: ENUM,
  // RANGE, and a composite. There is NO `AS <basetype>` form — that spelling is
  // CREATE DOMAIN, and accepting it here would have thrown away the one true
  // positive the 2026-08-11 live probe produced. The check below is therefore
  // deliberately a whitelist, not a fallthrough.
  if (parser.isWord("ENUM")) {
    parser.next();
    let error = parser.expectPunctuation("(", "Expected ( after ENUM");
    if (error) return error;

    for (;;) {
      if (parser.peek().type !== "string") {
        return parser.fail("UnexpectedToken", "Expected a quoted enum label");
      }
      parser.next();
      if (parser.isPunctuation(",")) {
        parser.next();
        continue;
      }
      break;
    }

    error = parser.expectPunctuation(")", "Expected ) to close the enum labels");
    if (error) return error;
    return parser.expectPunctuation(";", "Expected ; after the CREATE TYPE statement");
  }

  if (parser.isWord("RANGE")) {
    parser.next();
    const error = parseBalanced(parser, "Expected ( after RANGE");
    if (error) return error;
    return parser.expectPunctuation(";", "Expected ; after the CREATE TYPE statement");
  }

  // Composite: CREATE TYPE currency AS (amount NUMERIC(19,4), code CHAR(3));
  if (parser.isPunctuation("(")) {
    const error = parseBalanced(parser, "Expected ( to open the composite fields");
    if (error) return error;
    return parser.expectPunctuation(";", "Expected ; after the CREATE TYPE statement");
  }

  return parser.fail(
    "UnexpectedToken",
    `Expected ENUM, RANGE, or ( after AS, found "${parser.peek().value ?? "end of input"}". ` +
      "A type over an existing base type is CREATE DOMAIN, not CREATE TYPE"
  );
}

// <create_table_stmt> ::= "CREATE TABLE" <table_name> "(" <column_list> ");"
function parseCreateTable(parser) {
  if (!parser.isWord("CREATE")) {
    return parser.fail(
      "UnexpectedToken",
      `Expected CREATE, found "${parser.peek().value ?? "end of input"}"`
    );
  }
  parser.next();

  if (!parser.isWord("TABLE")) {
    return parser.fail(
      "UnexpectedToken",
      `Expected TABLE after CREATE, found "${parser.peek().value ?? "end of input"}"`
    );
  }
  parser.next();

  if (parser.peek().type !== "identifier") {
    return parser.fail("UnexpectedToken", "Expected a table name");
  }
  parser.currentTable = parser.next().value.toLowerCase();
  parser.schema.set(parser.currentTable, new Set());

  let error = parser.expectPunctuation("(", "Expected ( after the table name");
  if (error) return error;

  error = parseColumnList(parser);
  if (error) return error;

  if (!parser.isPunctuation(")")) {
    return unclosedOr(parser, "Expected ) to close the column list");
  }
  error = parser.expectPunctuation(")", "Expected ) to close the column list");
  if (error) return error;

  return parser.expectPunctuation(";", "Expected ; after the closing parenthesis");
}

// An unbalanced "(" is a different fault from a stray token, and the caret has
// to point at the "(" that was never closed rather than at end of input, which
// is where the reader is standing when they notice.
function unclosedOr(parser, message) {
  if (parser.parens.length > 0) {
    const open = parser.parens[parser.parens.length - 1];
    return parser.fail("UnclosedParenthesis", "Unclosed parenthesis", open);
  }
  return parser.fail("UnexpectedToken", message);
}

// <column_list> ::= <column_def> { "," <column_def> }
function parseColumnList(parser) {
  for (;;) {
    const error = parseColumnDef(parser);
    if (error) return error;

    if (parser.isPunctuation(",")) {
      parser.next();
      continue;
    }
    return null;
  }
}

// Definitions inside a table body that declare a constraint rather than a
// column. EXTENDED ONLY: the published grammar puts constraints only after a
// column's data type, so under `published` a line starting with one of these is
// a missing column name, which is what the parser reports.
const TABLE_CONSTRAINT_WORDS = new Set(["PRIMARY", "FOREIGN", "UNIQUE", "CHECK", "CONSTRAINT"]);

// <column_def> ::= <col_name> <data_type> [ <constraint> ]
function parseColumnDef(parser) {
  if (parser.peek().type !== "identifier") {
    return unclosedOr(
      parser,
      `Expected a column name, found "${parser.peek().value ?? "end of input"}"`
    );
  }

  if (parser.extended && TABLE_CONSTRAINT_WORDS.has(parser.peek().value.toUpperCase())) {
    return parseTableConstraint(parser);
  }

  const name = parser.next().value.toLowerCase();
  parser.schema.get(parser.currentTable)?.add(name);

  const error = parseDataType(parser);
  if (error) return error;

  return parseConstraint(parser);
}

// EXTENDED ONLY. Table-level constraints as PostgreSQL actually spells them,
// including the FOREIGN KEY form the published grammar got wrong: the local
// column list is required, `FOREIGN KEY (author_id) REFERENCES users(id)`.
function parseTableConstraint(parser) {
  if (parser.isWord("CONSTRAINT")) {
    parser.next();
    if (parser.peek().type !== "identifier") {
      return parser.fail("UnexpectedToken", "Expected a name after CONSTRAINT");
    }
    parser.next();
  }

  if (parser.isWord("CHECK")) {
    parser.next();
    return parseBalanced(parser, "Expected ( after CHECK");
  }

  if (parser.isWord("UNIQUE")) {
    parser.next();
    return parseBalanced(parser, "Expected ( after UNIQUE");
  }

  if (parser.isWord("PRIMARY")) {
    parser.next();
    if (!parser.isWord("KEY")) {
      return parser.fail("UnexpectedToken", "Expected KEY after PRIMARY");
    }
    parser.next();
    return parseBalanced(parser, "Expected ( after PRIMARY KEY");
  }

  if (parser.isWord("FOREIGN")) {
    parser.next();
    if (!parser.isWord("KEY")) {
      return parser.fail("UnexpectedToken", "Expected KEY after FOREIGN");
    }
    parser.next();

    const error = parseBalanced(parser, "Expected ( listing the local columns after FOREIGN KEY");
    if (error) return error;

    if (!parser.isWord("REFERENCES")) {
      return parser.fail(
        "UnexpectedToken",
        "Expected REFERENCES after the FOREIGN KEY column list"
      );
    }
    return parseReferences(parser);
  }

  return parser.fail("UnexpectedToken", "Unrecognised table constraint");
}

// Consumes a parenthesised run of tokens, checking only that the parentheses
// balance. CHECK expressions are arbitrary SQL and parsing them would mean
// implementing an expression grammar the thesis does not publish; balance is
// the property Layer 0 is responsible for, and the paren stack is what proves
// it. Recorded in the logbook as a documented limitation, not a shortcut.
function parseBalanced(parser, message) {
  const error = parser.expectPunctuation("(", message);
  if (error) return error;

  while (!parser.isPunctuation(")")) {
    if (parser.atEof()) return unclosedOr(parser, "Expected ) to close the expression");
    if (parser.isPunctuation("(")) {
      const nested = parseBalanced(parser, "Expected (");
      if (nested) return nested;
      continue;
    }
    parser.next();
  }
  return parser.expectPunctuation(")", "Expected ) to close the expression");
}

// REFERENCES <table_name> "(" <col_name> ")" shared by the inline and
// table-level forms.
function parseReferences(parser) {
  parser.next(); // REFERENCES
  if (parser.peek().type !== "identifier") {
    return parser.fail("UnexpectedToken", "Expected a table name after REFERENCES");
  }
  parser.next();
  const error = parseBalanced(parser, "Expected ( after the referenced table");
  if (error) return error;
  return parseReferentialActions(parser);
}

// EXTENDED ONLY. `ON DELETE CASCADE`, `ON UPDATE SET NULL`, and the rest.
// Added after the 100-instance Spider run, where their absence was reported as
// an unclosed parenthesis rather than as an unknown clause the misattribution
// already recorded for the published grammar, reappearing.
const REFERENTIAL_ACTIONS = new Set(["CASCADE", "RESTRICT"]);

function parseReferentialActions(parser) {
  while (parser.isWord("ON") && (parser.isWord("DELETE", 1) || parser.isWord("UPDATE", 1))) {
    parser.next(); // ON
    parser.next(); // DELETE | UPDATE

    if (parser.isWord("NO") && parser.isWord("ACTION", 1)) {
      parser.next();
      parser.next();
      continue;
    }
    if (parser.isWord("SET") && (parser.isWord("NULL", 1) || parser.isWord("DEFAULT", 1))) {
      parser.next();
      parser.next();
      continue;
    }
    if (parser.peek().type === "identifier" && REFERENTIAL_ACTIONS.has(parser.peek().value.toUpperCase())) {
      parser.next();
      continue;
    }
    return parser.fail(
      "UnexpectedToken",
      `Expected CASCADE, RESTRICT, NO ACTION, SET NULL or SET DEFAULT, found "${parser.peek().value ?? "end of input"}"`
    );
  }
  return null;
}

// A type name, optionally with a precision argument: VARCHAR(100),
// NUMERIC(10, 2). The parenthesised part is where the paren stack earns itself.
function parseDataType(parser) {
  if (parser.peek().type !== "identifier") {
    return parser.fail(
      "MalformedDataType",
      `Expected a data type, found "${parser.peek().value ?? "end of input"}"`
    );
  }
  parser.next();

  // EXTENDED ONLY. PostgreSQL spells several types as more than one word.
  // Consumed before the size argument, because CHARACTER VARYING(50) puts the
  // continuation word first.
  if (parser.extended) {
    if (parser.isWord("PRECISION") || parser.isWord("VARYING")) {
      parser.next();
    } else if (
      (parser.isWord("WITH") || parser.isWord("WITHOUT")) &&
      parser.isWord("TIME", 1) &&
      parser.isWord("ZONE", 2)
    ) {
      parser.next();
      parser.next();
      parser.next();
    }
  }

  if (parser.isPunctuation("(")) {
    let error = parser.expectPunctuation("(", "Expected ( in the type argument");
    if (error) return error;

    if (parser.peek().type !== "number") {
      return parser.fail("MalformedDataType", "Expected a number in the type argument");
    }
    parser.next();

    if (parser.isPunctuation(",")) {
      parser.next();
      if (parser.peek().type !== "number") {
        return parser.fail("MalformedDataType", "Expected a number after , in the type argument");
      }
      parser.next();
    }

    if (!parser.isPunctuation(")")) {
      return parser.fail("MalformedDataType", "Expected ) to close the type argument");
    }
    error = parser.expectPunctuation(")", "Expected ) to close the type argument");
    if (error) return error;
  }

  // EXTENDED ONLY. Array suffixes: TEXT[], VARCHAR(50)[], INT[][].
  if (parser.extended) {
    while (parser.isPunctuation("[")) {
      parser.next();
      if (!parser.isPunctuation("]")) {
        return parser.fail("MalformedDataType", "Expected ] to close the array suffix");
      }
      parser.next();
    }
  }

  return null;
}

// EXTENDED ONLY. A value in a DEFAULT clause: a literal, a function call, a
// row constructor, each optionally followed by one or more `::type` casts.
// Not an expression grammar the thesis publishes no expression production,
// so anything parenthesised is checked for balance and nothing more.
function parseValueExpression(parser) {
  if (parser.isPunctuation("(")) {
    const error = parseBalanced(parser, "Expected ( in the DEFAULT expression");
    if (error) return error;
  } else {
    const token = parser.peek();
    if (token.type !== "identifier" && token.type !== "string" && token.type !== "number") {
      return parser.fail("UnexpectedToken", "Expected a value after DEFAULT");
    }
    parser.next();
    if (parser.isPunctuation("(")) {
      const error = parseBalanced(parser, "Expected ( in the DEFAULT expression");
      if (error) return error;
    }
  }

  return parseCasts(parser);
}

// `0::NUMERIC`, `'USD'::CHAR(3)`, and chains of them.
function parseCasts(parser) {
  while (parser.peek().type === "operator" && parser.peek().value === "::") {
    parser.next();
    const error = parseDataType(parser);
    if (error) return error;
  }
  return null;
}

// <constraint> ::= "PRIMARY KEY"
//                | "FOREIGN KEY REFERENCES" <table_name> "(" <col_name> ")"
function parseConstraint(parser) {
  if (parser.extended) return parseExtendedConstraints(parser);

  if (parser.isWord("PRIMARY")) {
    parser.next();
    if (!parser.isWord("KEY")) {
      return parser.fail("UnexpectedToken", "Expected KEY after PRIMARY");
    }
    parser.next();
    return null;
  }

  if (parser.isWord("FOREIGN")) {
    parser.next();
    if (!parser.isWord("KEY")) {
      return parser.fail("UnexpectedToken", "Expected KEY after FOREIGN");
    }
    parser.next();
    if (!parser.isWord("REFERENCES")) {
      return parser.fail("UnexpectedToken", "Expected REFERENCES after FOREIGN KEY");
    }
    parser.next();
    if (parser.peek().type !== "identifier") {
      return parser.fail("UnexpectedToken", "Expected a table name after REFERENCES");
    }
    parser.next();

    let error = parser.expectPunctuation("(", "Expected ( after the referenced table");
    if (error) return error;
    if (parser.peek().type !== "identifier") {
      return parser.fail("UnexpectedToken", "Expected a column name in the reference");
    }
    parser.next();
    return parser.expectPunctuation(")", "Expected ) to close the reference");
  }

  return null;
}

// EXTENDED ONLY. Zero or more column constraints, in any order, as Agent 1
// emits them: `email VARCHAR(100) UNIQUE NOT NULL`, `status order_status
// DEFAULT 'pending'`, `order_id INT REFERENCES orders(order_id)`.
function parseExtendedConstraints(parser) {
  for (;;) {
    if (parser.isWord("NOT")) {
      parser.next();
      if (!parser.isWord("NULL")) {
        return parser.fail("UnexpectedToken", "Expected NULL after NOT");
      }
      parser.next();
      continue;
    }

    if (parser.isWord("NULL") || parser.isWord("UNIQUE")) {
      parser.next();
      continue;
    }

    if (parser.isWord("PRIMARY")) {
      parser.next();
      if (!parser.isWord("KEY")) {
        return parser.fail("UnexpectedToken", "Expected KEY after PRIMARY");
      }
      parser.next();
      continue;
    }

    if (parser.isWord("DEFAULT")) {
      parser.next();
      const error = parseValueExpression(parser);
      if (error) return error;
      continue;
    }

    if (parser.isWord("REFERENCES")) {
      const error = parseReferences(parser);
      if (error) return error;
      continue;
    }

    if (parser.isWord("CHECK")) {
      parser.next();
      const error = parseBalanced(parser, "Expected ( after CHECK");
      if (error) return error;
      continue;
    }

    return null;
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * @param {string} ddl  the DDL Agent 1 produced
 * @param {object} [options]
 * @param {"published"|"extended"} [options.grammar="published"]
 *   `published` is §2.5.1 exactly as printed. `extended` covers the constructs
 *   Agent 1 actually emits. Both verdicts come from this one code path so the
 *   two acceptance rates are comparable; the Spider evaluation records both per
 *   instance. The default is `published` deliberately: the strict reading is
 *   the one a caller should have to opt out of, not into.
 * @returns {{passed: boolean, layer: number, error?: object, feedback?: string}}
 */
export function verifyGrammar(ddl, options = {}) {
  const { grammar = "published" } = options;
  if (typeof ddl !== "string" || ddl.trim() === "") {
    return {
      passed: false,
      layer: LAYER,
      error: {
        type: "EmptyOutput",
        message: "No schema was produced",
        line: null,
        column: null,
      },
      feedback: `Layer ${LAYER} (grammar): no schema was produced. Return a complete set of CREATE TABLE statements.`,
    };
  }

  const { tokens, error: lexical } = tokenise(ddl);
  if (lexical) {
    return {
      passed: false,
      layer: LAYER,
      error: lexical,
      feedback: feedbackFor(lexical, ddl),
    };
  }

  const parser = new Parser(tokens, grammar === "extended");
  const error = parseScript(parser);
  if (error) {
    return { passed: false, layer: LAYER, error, feedback: feedbackFor(error, ddl) };
  }

  // The schema map is returned on success so a caller does not have to re-read
  // the DDL that this layer has just finished reading properly. Layer 2 still
  // builds its own; tests/layer0.test.js asserts the two agree.
  return { passed: true, layer: LAYER, schema: parser.schema };
}
