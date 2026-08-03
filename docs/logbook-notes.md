# Logbook

## Week 7 2026-07-25 Agent 1 walking skeleton

**Done:** repo live, Ollama wrapper (`src/config/ollama.js`), Agent 1
(`src/agents/schemaSynthesiser.js`) constrained system prompt + deterministic
decoding + defensive fence-stripping. End-to-end run via `src/index.js` returns
clean PostgreSQL DDL for the `users` prompt.

**Latency measurement (same machine, model `qwen2.5-coder:7b`):**
Timed with `performance.now()` around the `synthesiseSchema` call. Model was
unloaded (`ollama stop`) before the batch to force a genuine cold start, then
run five times back-to-back.

- Cold start (run 1, includes loading the 7b model into memory): **~24.4 s**
- Warm runs (2–5): 4735, 4706, 4723, 4725 ms → **median ~4.7 s (4724 ms)**

The warm cluster is within ~30 ms across four runs — a separate observation
about warm-run _timing_ consistency. (Note: stable wall time does not prove
deterministic decoding — identical timing is possible with different tokens.
Determinism is proven by byte-identical _output_, recorded under limitation 3.)

### Technical limitations

1. **Output formatting** model wraps DDL in prose + ```sql fences.
   - _Cause:_ instruction-tuned chat behaviour; the base model wants to explain
     and format for a human reader.
   - _Mitigation:_ constrained system prompt (DDL-only, no prose, no fences)
     passed via Ollama's top-level `system` field, plus a defensive
     regex fence-stripper (`stripFences`) as a stopgap.
   - _Residual risk:_ stray commentary or leading text is still possible on
     prompts the system instruction doesn't fully suppress. The fence-stripper
     removes fences but not arbitrary prose. **Agent 3 must not assume clean
     input** it needs its own validation/parse step, not blind trust.

2. **Latency** cold start ~24.4 s, warm median ~4.7 s.
   - _Cause:_ 4 GB VRAM can't hold the 7b model fully; inference splits across
     GPU and system RAM, and the cold load pays the full model-into-memory cost.
   - _Note:_ absolute figures are machine-specific and not meaningful alone. To
     be reported as a **relative comparison vs the monolithic baseline
     (Week 9), same machine** the multi-agent split will add per-agent
     round-trips, so this warm median is the per-call unit to multiply.

3. **Non-determinism** repeated runs can otherwise differ (e.g. `VARCHAR(255)`
   vs `TEXT`, or column ordering).
   - _Mitigation:_ `temperature: 0` + fixed `seed: 42` in the options block.
     Verified: DDL output of two fresh runs piped through `diff` — exit 0, i.e.
     byte-for-byte identical.
   - _Residual risk:_ greedy decoding is reproducible on _this_ model + version,
     but is **not guaranteed identical across model or Ollama version updates**,
     or across different hardware. Pinning the model tag is advisable before any
     result is treated as a fixed baseline.

## Week 8 2026-07-29 Agent 2 API route architect (prompt iteration)

**Done:** `src/agents/routeArchitect.js` constrained system prompt (Express
routes from DDL, code-only), deterministic decoding, defensive fence-stripping,
wired into `src/index.js` on Agent 1's output. Iterated the prompt across four
versions against a fixed blog DDL fixture (users/posts/tags + `post_tags`
junction) so only the prompt varied, then a fifth against two fixtures.
Baseline for the next iteration: **v5**, committed with a known, documented
defect it does not parse on one of the two fixtures. See the v5 note below
and limitations 2 and 3.

| criterion              | v1   | v2   | v3      | v4   | v5          |
| ---------------------- | ---- | ---- | ------- | ---- | ----------- |
| valid / parses         | ✅   | ✅   | ✅      | ✅   | ⚠ blog only |
| 404 via `rowCount`     | ❌   | ✅   | ✅      | ✅   | ✅          |
| junction nested        | ✅\* | ✅   | ✅      | ✅   | ✅          |
| DEFAULT-col INSERT     | ❌   | ❌   | ✅      | ✅   | ✅          |
| `updated_at` on UPDATE | ❌   | ❌   | ⚠ broke | ❌   | ❌‡         |
| no invented columns    | ✅   | ✅   | ✅      | ✅§  | ✅          |
| runtime-correct        | ✅   | ✅   | ❌      | ✅†  | ❌          |
| latency (s)            | 181  | 205  | 244     | 241  | 235 / 179   |
| output (chars)         | 5945 | 6423 | 7581    | 7195 | 7236 / 5858 |

\* v1 nested the junction table unprompted, before the rule existed.
† on the blog fixture only see limitation 3.
‡ absent by design in v5, not by failure: the instruction was deliberately
removed and the timestamp deferred to an Agent 1 trigger (limitation 4). In
v1v4 the same ❌ means the model dropped an instruction that was present.
§ v4 is clean on the blog fixture; the `updated_at` invention appeared only on
its separate orders run (limitation 4). Checked by extracting every column name
occupying a SQL column position an INSERT column list, an UPDATE SET clause,
or an allowlist and testing membership against the DDL. Request-body field
names are deliberately excluded, since they need not match column names.

v1v4 figures are the blog fixture. v5 is given as **blog / orders**, the only
version run against both in one sitting; v4's separate orders run (200 s,
6349 chars, 13 routes) is described under the cross-schema test below. All
parse results in this table were re-verified with a working gate after the
defect in limitation 2 was found.

**Wrapper verification.** Confirmed `generate()` threads both `system` and
`options` into the Ollama request body rather than silently dropping them: a
Turkish-only system prompt changed the output language, two runs at
`seed: 42` were byte-identical, and `seed: 999` at `temperature: 1.8` diverged.
The determinism claimed for Agent 1 therefore also holds for Agent 2.

**Cross-schema test.** Re-ran v4 on an unrelated Agent 1 output
(customers/orders/order_line_items, 200 s, 13 routes) to check whether the
worked examples embedded in the prompt contaminate other domains. No leakage:
all nine example-specific tokens (`users`, `posts`, `tags`, `post_tags`,
`title`, `content`, `author_id`, `username`, `password_hash`) appear zero times
in the generated module, and the router correctly used `customer_id` and
`order_id` as primary keys rather than the examples' `id`.

**v5 the `updated_at` removal (first half of a two-part change).** Deleted the
`updated_at` instruction from Agent 2's prompt, keeping the static-PUT rule in
the same block, since that rule is what prevents v3's parameter-misalignment
bug. Re-ran on both fixtures. The fix worked: `updated_at` occurs zero times in
both outputs, no referenced column is absent from its DDL, and the orders PUT
handlers are now correct fixed SQL. Blog 235 s / 7236 chars, orders 179 s /
5858 chars. The second half Agent 1 emitting a Postgres trigger to own the
timestamp is a separate change to a different agent and its own sitting.

v5 ships with two defects, both in nested-resource handlers:

- `v5-orders` **does not parse**: the nested POST emits
  `["$" + (i + 1) for (i in cols)]`, a legacy array comprehension removed from
  JavaScript.
- `v5-blog`'s nested POST reads `postId` from `req.body` when the route
  declares it as `req.params`, so the insert always binds NULL for `post_id`.
  That column is declared `INT NOT NULL`, so the statement fails the NOT NULL
  constraint (SQLSTATE 23502) before the foreign key is evaluated a NULL
  foreign-key column would itself be permitted, since unmatched NULLs pass an
  FK check by design. This file parses cleanly.

Both land on the one route type the prompt gives **no worked example** for.
Every handler that has an example is clean on both fixtures. The reusable
finding: this model pattern-matches to concrete examples far more reliably than
it follows prose rules, which is a stronger lever than rule-wording but does
not generalise to unexemplified cases. Deliberately not fixed by adding another
example yet doing so would be tuning the prompt until two specific fixtures
pass, which limitation 3 shows is not evidence of correctness.

### Technical limitations

1. **Constraint saturation** the model cannot satisfy every constraint at once;
   adding one reliably costs another.
   - _Cause:_ each rule competes for the same limited instruction-following
     capacity in a 7b model. Rules describing the _shape_ of the output (route
     set, import lines, try/catch, status codes) survive, because they match
     patterns dominant in its training data. Rules that are _conditional_ on
     inspecting the input ("if the table declares `updated_at`…", "unless
     `req.body` contains…") are dropped first, because they require the model
     to hold a fact about the schema while generating unrelated code. v3 added
     `updated_at` and broke runtime correctness; v4 restored runtime
     correctness and lost `updated_at` again. Four versions, never both.
   - _Mitigation:_ stopped competing for the constraint. v5 removes the
     `updated_at` instruction from Agent 2 entirely and reassigns the
     requirement to Agent 1 as a trigger (limitation 4), rather than continuing
     to tune wording. Splitting a constraint across agents is the only move
     that reduced total constraint pressure; every attempt to satisfy both in
     one prompt cost something else.
   - _Residual risk:_ the saturation itself is not fixed, only relieved for one
     constraint. v5 immediately demonstrated it again at the next weakest
     point, emitting two defective nested-POST handlers once the freed capacity
     went elsewhere. Any future rule added to this prompt should be expected to
     cost an existing one, which is why correctness cannot rest on prompt
     tuning and motivates deterministic verification in Agent 3.

2. **The validation gate reported success on a file that is not valid
   JavaScript** the syntax check relied on throughout this session accepted
   an output that cannot be parsed or executed.
   - _Observation:_ on Node v20.19.6, `node --check v5-orders.js` exits 0,
     while the file contains `["$" + (i + 1) for (i in cols)]` a legacy array
     comprehension that is not valid in any current JavaScript dialect.
     Controlled variation on that single line, everything else held constant:

     | file under test                         | exit |
     | --------------------------------------- | ---- |
     | the line alone in a plain `.js` file    | 1    |
     | same file, with `import`/`export` added | 0    |
     | byte-identical file renamed `.mjs`      | 1    |

     The one varying factor is the presence of ES module syntax under a `.js`
     extension. **What is established is the behaviour, not its cause:** these
     runs do not show whether Node skips parsing, parses under different
     semantics, or bails early, and no claim about the mechanism is made here.
     The observation alone is sufficient the gate returned success on a file
     that is not valid ESM.

   - _Consequence:_ every Agent 2 output is an ES module written to a `.js`
     file, so **every "parses" verdict recorded during this session was
     unearned.** Re-checked afterwards with a working gate: v1v4 and v5-blog
     genuinely parse, v5-orders does not. The earlier verdicts happened to
     hold, but they were luck, not measurement.
   - _Mitigation:_ **implemented** on 2026-07-30, see the Agent 3 Layer 1 entry
     below. Neither option originally proposed here was taken: rather than
     working around the shell command with `.mjs` or
     `node --input-type=module --check`, Layer 1 parses in-process with Acorn
     and declares `sourceType: "module"` itself. Both workarounds would still
     have left the parser's configuration to be inferred from a filename or a
     flag passed correctly every time; declaring it removes the inference that
     caused the false pass rather than routing around it.
   - _Relevance to the thesis:_ this is first-hand evidence for the central
     claim that generated artefacts require deterministic verification rather
     than trust. The failure is not that a check was missing it is that a
     standard, widely trusted tool **reported success on invalid input**, and
     did so convincingly enough to go unnoticed across four prompt versions. It
     answers directly why a deterministic AST-based verifier is worth building
     when `node --check` already exists: because `node --check` returned
     success for a file that will not parse. A gate whose success signal cannot
     be distinguished from silence provides no assurance at all, which is the
     strongest available argument for Agent 3 verifying against a parser it
     controls rather than delegating to a shell call whose failure mode is
     invisible.

3. **Correctness is schema-specific, and structural checks miss what matters**
   passing every structural check is not evidence of a working backend.
   - _Cause:_ v3 satisfied all nine structural checks (no fences, correct
     imports, parameterised queries, no invented body columns) while being
     unrunnable: it emitted `CURRENT_TIMESTAMP` as a bare JavaScript identifier
     (`ReferenceError` at runtime) and shifted every `$n` parameter one
     position out of alignment both faults are syntactically valid
     JavaScript. v4 then passed the same checks _and_ ran correctly on the blog
     fixture, but on the orders schema its PUT handlers compute the id
     placeholder as `$${cols.length * 2}` binding three parameters while
     referencing `$4`. v5 repeated the pattern at a third level: `v5-blog`
     parses perfectly and is still wrong, reading a URL parameter from the
     request body.
   - _Mitigation:_ none at the prompt layer. Recorded as a measurement problem.
   - _Residual risk:_ **an evaluation harness that scores Agent 2 on parse
     success and structural checks will score broken backends as passes.**
     Scoring must execute the generated routes against a live schema, and must
     use more than one fixture a single fixture demonstrated correctness that
     did not generalise to the second schema tested.
   - _Specification value:_ the two v5 defects are a live specification for the
     verifier, one per layer. The orders array comprehension is a syntax error
     only a real parser catches (Layer 1). The blog `req.body`/`req.params`
     confusion parses cleanly and is only catchable by checking the handler
     against the route's declared parameters and the schema (Layer 2). These
     came from real runs, not synthetic examples.

4. **Column hallucination under instruction pressure (resolved in v5)** v4
   emitted UPDATEs referencing an `updated_at` column on schemas that do not
   declare one.
   - _Cause:_ the prompt instructs the model to append
     `updated_at = CURRENT_TIMESTAMP` whenever the table declares that column.
     The conditional half is dropped (see limitation 1) while the imperative
     half is retained, so the instruction becomes unconditional and the model
     invents the column. On the orders schema `updated_at` occurs zero times in
     the DDL yet appears in both PUT handlers; Postgres would reject these with
     `column "updated_at" of relation "customers" does not exist`. Instructing
     _harder_ made the output worse, not better.
   - _Mitigation:_ v5 deleted the `updated_at` instruction from Agent 2's
     prompt. Verified on both fixtures: zero occurrences, and every column
     referenced by the generated routes exists in its DDL. The second half
     having Agent 1 emit a Postgres trigger, which is where a modify-timestamp
     belongs regardless is not yet done.
   - _Residual risk:_ until that trigger exists, `updated_at` is declared in
     the schema but never maintained by anything. The column will silently hold
     its insert-time value. This is a correctness gap that has moved from the
     API layer to the schema layer, not one that has been closed.

5. **Latency** Agent 2 ranges 181241 s per generation, against Agent 1's
   ~4.7 s warm median.
   - _Cause:_ Agent 2 emits a whole module (6-7.5 kB, ~40x Agent 1's output)
     on the same 4 GB VRAM split, so it pays the GPU/system-RAM penalty across
     far more decoded tokens. Cost scales with output length, not task
     difficulty.
   - _Implication:_ an N=5 evaluation loop is ~20 min worst case, which exceeds
     common HTTP client timeouts, so the driver needs an explicit timeout
     rather than the default. Keep Agent 3's verification cheap and
     deterministic; it cannot be another generative round-trip at this cost.
     Revisit N, or cap output length, before the Week 9 baseline comparison.

## Week 8 2026-07-30 Agent 3 integrity verifier (Layer 1)

**Done:** `src/agents/integrityVerifier.js`. Exports `verifyIntegrity(code)`,
which takes Agent 2's output as a string and answers one question: does it
parse. Parsing is done in-process with Acorn 8.18.0 (`acorn` added as the
project's first runtime dependency, committed separately from the verifier).

**`sourceType: "module"` is declared, not inferred.** This is the structural
answer to the false pass recorded in limitation 2 of the previous entry. The
call is
`acorn.parse(code, { ecmaVersion: "latest", sourceType: "module", locations: true })`.
Agent 2 always emits an ES module, so the parser is told so directly. The
earlier failure was not that a check was missing but that a shell command was
left to infer its own parsing mode from a filename, and inferred one under
which the check reported success on a module that does not parse. Owning the
parser settings removes the inference rather than working around it, which is
why Acorn was preferred over the `.mjs` and `--input-type=module` workarounds
proposed when the defect was found.

**Verified against the two real defects from the v5 run**, not synthetic
examples:

| input          | expected     | result                                   |
| -------------- | ------------ | ---------------------------------------- |
| `v5-orders.js` | reject       | `passed: false`, `SyntaxError` at 173:34 |
| `v5-blog.js`   | pass Layer 1 | `passed: true`, AST returned (22 nodes)  |
| `null`         | reject       | `passed: false`, `EmptyOutput`           |

`v5-orders` is rejected at the array comprehension that `node --check` accepted.
`v5-blog` passes, which is the correct verdict it is syntactically valid and
still wrong, reading a URL parameter from the request body. The two defects
therefore sit either side of the layer boundary and act as a specification: one
is catchable only by a parser, the other only by a later relational check.

**Failure results carry a rendered excerpt, not just a position.** On rejection
the return value includes structured `error` fields (`type`, `message`, `line`,
`column`) for logging and for counting failure types across a run, plus a
`feedback` string containing the offending source line with a caret beneath it:

```
Layer 1 (syntax): the module you returned does not parse as JavaScript.
Unexpected token at line 173, column 34:

  173 |     const params = ["$" + (i + 1) for (i in cols)].join(", ");
      |                                   ^

Return the complete module again, corrected so that it parses as an ES module.
```

The excerpt exists because Agent 2 receives a plain string and never sees line
numbers, so a bare `line: 173` is useless as correction input. Rendering it
here, next to the error, keeps the re-prompt text with the component that
knows the fault rather than requiring the driver to reassemble it later.

**Empty-output guard.** `verifyIntegrity` returns a structured `EmptyOutput`
result for a non-string or blank input instead of throwing. Added because
Agent 2's scaffold returned `null` before its prompt existed, and a verifier
that throws on empty input halts the loop it is meant to drive.

### Design decision: `passed`, not `verified`

The per-layer result field is called `passed`, and the module documents that
`verified` is reserved for an orchestrator that has run every layer.

- _Reasoning:_ a Layer 1 pass means the module parses. It does not mean the
  module is correct `v5-blog` is the proof, passing Layer 1 while being
  wrong. A field named `verified` returning `true` for that file would assert
  more than the work performed, and a comment saying so does not prevent a
  caller writing `if (result.verified)`. Renaming makes the mistake
  structurally unavailable rather than merely discouraged.
- _Why it matters here specifically:_ this is the same fault as the one in
  limitation 2 of the previous entry a success signal that reads as more
  assurance than was actually earned. Having identified that failure mode, it
  would be indefensible to reproduce it inside the component built to prevent
  it.
- _Cost:_ none at present. Nothing imports the module yet, so the rename cost
  no call-site changes; it would have once the driver and later layers depend
  on it.

### Technical limitations

1. **Layer 1 is a necessary and very weak condition** it rejects only code
   that cannot parse.
   - _Cause:_ syntactic validity says nothing about whether routes match the
     schema, parameters bind correctly, or handlers read from the right part of
     the request. Of the defects observed across five Agent 2 versions, only
     one (`v5-orders`) is caught here; the parameter misalignment in v3, the
     invented `updated_at` column in v4, and the `req.body`/`req.params`
     confusion in `v5-blog` all parse cleanly.
   - _Implication:_ Layer 1 alone must never gate a result. Reporting a
     Layer 1 pass as success would recreate the very false pass this component
     was built in response to, which is why the return field is `passed` and
     not `verified`.

2. **The error-message normalisation depends on Acorn's formatting**
   `err.message` has its trailing `(line:column)` stripped so identical faults
   group together when failures are counted.
   - _Cause:_ Acorn currently appends the position to the message text. This is
     a formatting convention, not a documented API guarantee.
   - _Bounded consequence:_ if the format changes the replacement becomes a
     no-op and the position appears twice in the feedback string. That is
     cosmetic. It cannot produce a wrong verdict: pass and fail are decided by
     whether `acorn.parse` throws, and `err.loc` is the authoritative source of
     line and column. The string handling is on the reporting path only.

## Week 8 — 2026-08-04 — Agent 3 relational validator (Layer 2)

**Done:** `src/agents/relationalValidator.js`, a separate module from Layer 1
returning the same result contract (`passed`, `layer`, `error`, `feedback`).
Exports `validateRelations(ast, ddl)` and takes two inputs: the AST Layer 1
returned on success, and the DDL Agent 1 produced. It never re-parses the
source, so Layer 1 is a precondition rather than a suggestion. One assertion:
**every column the routes reference exists in the schema.**

Three steps. (1) Build `table → Set<column>` from the DDL. (2) Walk the AST for
SQL strings passed to `pool.query`, tagged with the enclosing `router.<verb>`
route and source line. (3) Test each referenced column for membership.

**Fixtures are now in the repository** (`tests/fixtures/`). The v1–v5 outputs
and both DDLs existed only in a session scratch directory and were one cleanup
away from being lost, which would have made every earlier logbook claim
unreproducible. Generated modules are stored as `.js.txt` so nothing attempts
to import them — `v5-orders` does not parse, which is the point of keeping it.
Run with `npm test`.

| input       | expected     | result                                         |
| ----------- | ------------ | ---------------------------------------------- |
| `v4-orders` | fail Layer 2 | `passed: false`, `UnknownColumn`, 2 violations  |
| `v4-blog`   | pass         | `passed: true`                                 |
| `v5-blog`   | pass Layer 2 | `passed: true`                                 |
| `v5-orders` | fail Layer 1 | never reaches Layer 2                          |

**The proof case works.** `v4-orders` parses cleanly at Layer 1 — limitation 1
of the previous entry lists it among the defects Layer 1 cannot see — and is
rejected here, naming both call sites:

```
Layer 2 (schema): the routes reference columns that do not exist in the schema.

- Column "updated_at" in route PUT /customers/:id (line 60): table "customers"
  has no such column. Its columns are: customer_id, first_name, last_name,
  email, status.
- Column "updated_at" in route PUT /orders/:id (line 139): table "orders" has
  no such column. Its columns are: order_id, customer_id, order_date,
  total_amount, status.
```

**`v4-blog` is the control that makes the result mean anything.** It is the
same generator version emitting the same `updated_at = CURRENT_TIMESTAMP`
fragment, and it passes — because the blog schema declares `posts.updated_at`.
The two cases differ only in the DDL, which is what distinguishes a
schema-relative check from a blocklist on the string `updated_at`. Without this
case the v4-orders rejection would be indistinguishable from hard-coding the
answer.

All violations are reported together rather than one at a time. Agent 2
regenerates the whole module regardless, so a single-violation result would
spend a ~200 s round trip per defect.

### Design decision: matching is per-table, not against a union of all columns

- _Reasoning:_ the union is too permissive on exactly the schemas being
  generated. In the orders fixture `customer_id` is declared on both
  `customers` and `orders`, and `order_id` on both `orders` and
  `order_line_items`. Under a union check `UPDATE order_line_items SET
  customer_id = $1` passes, because the name exists somewhere — while Postgres
  rejects it. Per-table matching is the assertion the database actually makes,
  and Layer 2 is only worth building if it predicts that.
- _Cost:_ near zero. Agent 2 emits single-table statements exclusively, so the
  target is whatever follows `INSERT INTO`, `UPDATE`, or `FROM`. No aliases, no
  joins, no resolution to do.
- _Fallback:_ where the target cannot be determined the check widens to the
  union rather than guessing, and records `table: null` so the weakened verdict
  is visible in the result instead of silent.
- _Why that direction:_ the error costs are asymmetric. A false failure sends
  Agent 2 into a repair loop on correct code at ~200 s per regeneration and
  teaches it to "fix" something that was never broken. A miss costs one
  undetected defect that a later layer or the runtime still catches.

**This was not hypothetical — the first implementation produced exactly that
false failure.** `v5-blog` was rejected for referencing `post_id` on `tags`.
The statement is `SELECT * FROM tags WHERE id IN (SELECT tag_id FROM post_tags
WHERE post_id = $1)`, which is correct SQL: `post_id` belongs to the subquery's
table. Target resolution had checked for JOINs and comma-separated `FROM` lists
but not for a second table entering scope through a subquery, so it attributed
an inner column to the outer table. Fixed by counting table-naming positions
(`FROM`, `INSERT INTO`, `UPDATE`) and refusing to attribute when there is more
than one, plus an explicit `( SELECT` test. Worth recording because the failure
landed on the expensive side of the asymmetry above, on the first run, on real
output — the fallback policy was not over-caution.

### Design decision: completeness is not owned by Layer 2

Chapter II frames verification as soundness _and_ completeness. Layer 2 owns
soundness only — "every referenced column exists". Completeness — "every table
has routes" — is assigned to a later coverage layer.

- _Reasoning:_ the two fail in different directions and cannot share a gate. A
  soundness failure means the code is definitely broken; Postgres raises
  `column ... does not exist` on the first request. A completeness failure means
  something _may_ be missing, and Agent 2's own prompt makes absence legitimate
  — a junction table is explicitly not a resource and gets nested routes under
  its owner instead. A gate blocking on completeness would reject correct output
  for obeying its instructions.
- _Feedback points the opposite way too:_ soundness names a defect to remove and
  is directly actionable in a re-prompt. Completeness names work to add, which
  is a coverage measurement — better scored than gated, at least until
  legitimate exemptions can be recognised reliably.
- _Consequence:_ `passed` at Layer 2 keeps a single meaning — nothing referenced
  is wrong, not nothing is missing.

### Technical limitations

1. **The DDL reader is a lexical scan, not a SQL parser** — a deliberate
   shortcut, recorded here rather than left implicit.

   - _What it does:_ finds `CREATE TABLE` blocks by regex, matches parentheses
     by counting depth, splits the body on top-level commas, and takes the first
     identifier of each definition, skipping definitions beginning `PRIMARY`,
     `FOREIGN`, `UNIQUE`, `CONSTRAINT`, `CHECK`, `EXCLUDE`, `LIKE`.
   - _What it does not understand:_ `ALTER TABLE ... ADD COLUMN`, quoted
     identifiers containing spaces or punctuation, inheritance or `LIKE`-cloned
     tables, views, or a `CREATE TABLE` inside a string literal or comment.
   - _Deviation from the sketched approach:_ splitting on top-level commas
     rather than on newlines. Same shortcut class, same cost, but it also
     handles a single-line `CREATE TABLE x (a INT, b INT)` correctly, which a
     line-based split silently truncates to its first column.
   - _Consequence:_ a missed column makes the schema map too small and turns a
     valid column into a reported invention — a false failure, the expensive
     direction. Verified correct on both current fixtures: all four blog tables
     and all three orders tables parse to exactly their declared columns, with
     `CREATE TYPE ... AS ENUM` blocks correctly ignored and `NUMERIC(10, 2)` not
     mis-split.

2. **Dynamically built column lists are invisible to this layer.**

   - _Cause:_ Agent 2 builds INSERT and UPDATE column lists from a JavaScript
     `allowed` array — `INSERT INTO customers (${cols.join(", ")})`. Only the
     static text of a template literal is analysed, so those names never reach
     the check.
   - _Consequence:_ an invented column appearing _only_ in an `allowed` array
     passes Layer 2 today. The hand-check performed on v4 in the previous entry
     did read allowlists, so this layer is currently weaker than that manual
     check on precisely that surface.
   - _Next assertion:_ read array literals assigned to `allowed` and test their
     members against the target table of the query they feed.

3. **Layer 2 does not catch the `v5-blog` defect, despite the previous entry
   implying it would.** That entry recorded the `req.body`/`req.params`
   confusion as "only catchable by checking the handler against the route's
   declared parameters and the schema (Layer 2)". Column existence is not that
   check — `v5-blog` references only real columns and passes here, correctly.
   Binding a URL parameter to the right request property is a separate
   assertion over the same inputs; it belongs in this layer but is not yet
   built. The earlier sentence overstated what a single assertion covers, and
   the claim is corrected here rather than quietly satisfied.
