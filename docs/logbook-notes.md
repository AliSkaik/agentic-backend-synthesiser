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

## Week 8 — 2026-08-04 — N=5 reflection loop (Agent 3 completion)

**Done:** `src/verify.js` and `src/reflect.js`, plus an explicit timeout on the
Ollama call and a `feedback` argument on Agent 2.

`verify(code, ddl)` runs Layer 1, short-circuits on failure — Layer 2 consumes
Layer 1's AST and is unrunnable without it — and returns `verified: true` only
when both layers pass. It is the only module permitted to set that word. The
header of `integrityVerifier.js` had reserved it for "the orchestrator that runs
all of them", which until now was a rule stated in a comment and enforced
nowhere. The four fixture cases moved onto `verify()` unchanged, and still give
the same four verdicts.

`reflect(ddl, options)` is the loop: generate, verify, and on failure re-prompt
Agent 2 with the DDL plus the single latest `feedback` string, up to five
generations in total (one initial, four repairs). On exhaustion it emits
nothing. Its whole view of Agent 3 is one boolean and one string, so a third
layer requires no change to it.

**The loop cannot retry, only re-prompt.** Agent 2 runs at `temperature: 0,
seed: 42`, so an unchanged request returns a byte-identical module. The only
reason attempt *k+1* can differ from attempt *k* is that the prompt changed, and
the only thing changing it is Agent 3's `feedback`. That retrospectively
justifies rendering the offending source line with a caret inside Layer 1
rather than returning a bare line number: Agent 2 receives a plain string and
never sees the structured error, so `line: 173` alone would not be correction
input.

### First live run: converged on attempt 2, and lost a third of the API doing it

Seeded from `v4-orders` against the orders schema, so attempt 1 cost no
generation. One run, nothing tuned.

| attempt | source    | latency    | chars | routes | verdict                           |
| ------- | --------- | ---------- | ----- | ------ | --------------------------------- |
| 1       | seed      | —          | 6 349 | 13     | fail Layer 2, 2 × `UnknownColumn` |
| 2       | generated | 149 592 ms | 4 242 | 10     | **verified**                      |

The named defect was repaired: `updated_at` occurs twice in the seed and zero
times in the repair. The module also lost all three `order_line_items` routes.
`verify()` returned `verified: true` on it, correctly — the gate asserts
soundness, and the shrunken module is sound.

**Deleting a route is a valid way to satisfy a soundness check**, because it
removes the offending column reference. Under constraint saturation
(limitation 1 of the Agent 2 entry) the cheapest path to compliance is to emit
less, and that is the path taken. This is the cost anticipated when the design
chose to forward only the latest feedback — "may repair the named defect while
re-breaking something an earlier attempt had right" — observed on the first live
run rather than in principle.

What was not anticipated is that **the transcript hid it.** It recorded a clean
two-attempt convergence; the loss was found by reading the two modules side by
side, which will not happen across a full run. A `routeCount` per attempt is now
recorded for exactly this reason, with a stub case asserting that a
repair-by-deletion stays visible in the transcript despite a `verified` verdict.
The count is lexical rather than AST-based deliberately: an attempt that fails
Layer 1 has no AST, and those are precisely the attempts worth comparing against
their successor.

**This does not reverse the decision that completeness is not gated** (see the
Layer 2 entry — a junction table legitimately has no routes, so a completeness
gate would reject correct output). It changes the priority of the coverage score
that entry defers: the loop actively pressures the model toward deletion, so
coverage is now load-bearing rather than a later refinement.

### `order_line_items` is misclassified by Agent 2, in both directions

It has a `SERIAL PRIMARY KEY` (`line_item_id`), so under Agent 2's own system
prompt it is a resource and should have five top-level routes. The seed nested
it under `/orders` as though it were a join table; the repair dropped it
entirely. Neither is right. **This predates the loop and is not caused by it** —
recorded here because it surfaced while reading the run, and because it means
the 13 → 10 route loss is a regression against an already-wrong baseline rather
than against a correct one.

### Technical limitations

1. **Convergence is measured on n = 1.** One run, one fixture, one defect class
   (Layer 2 / `UnknownColumn`), seeded rather than generated.
   - _Consequence:_ "converged on attempt 2" is an observation, not a
     convergence rate. The Layer 1 syntax-repair path (`v5-orders`) has never
     been run against the live model — only against the stub. Nothing yet
     establishes that syntax feedback repairs anything.
   - _Not re-run after the finding._ A second run issued after seeing the route
     deletion is the beginning of tuning, which limitation 3 of the Agent 2
     entry already shows is not evidence of correctness.

2. **The feedback preamble is an uncontrolled variable.** The user prompt sent
   on a repair is the DDL, then the line "Your previous attempt at this task was
   rejected by an automated check.", then Agent 3's `feedback` verbatim.
   - _Cause:_ the design fixed _where_ feedback goes (user prompt, never the
     system prompt) but not what frames it, and a re-prompt with no framing at
     all reads as a second, unrelated instruction block.
   - _Consequence:_ the convergence above is attributable to the critique **plus
     that sentence**, not to the critique alone. The two have not been
     separated, so a claim of the form "the model repairs from deterministic
     feedback" is not supported at the granularity it appears to be. **This can
     produce a wrong attribution in Chapter IV, not a wrong verdict** — the gate
     is unaffected either way.
   - _Next:_ one paired run, same seed, with and without the preamble, before
     any convergence figure is reported.

3. **The 600 s timeout is untested at its own value.** What is proven is that
   `AbortSignal.timeout` fires, that the abort is caught, and that it maps to a
   distinctly named `OllamaTimeoutError` — proven at a 1 ms budget. 600 000 is a
   constant chosen against the observed 181–244 s range, not one that has been
   reached. Cosmetic risk only: a wrong constant produces a run that aborts or
   waits longer than intended, never a wrong verdict.

4. **Timeout classification depends on how undici names an abort.** It tests
   `err.name === "TimeoutError"` and `err.cause?.name === "TimeoutError"` — the
   same class of assumption already recorded for Acorn's message formatting.
   - _Consequence:_ if a future Node changes it, the loop still ends and is
     still typed `infrastructure`, because that is set by the catch rather than
     by the error's name. Only `error.type` degrades to something less specific.
     Cosmetic; it cannot turn a failure into a pass.

5. **An infrastructure failure and a verification failure are typed apart, and
   that had to be deliberate.** An Ollama error, a non-2xx response, or a
   timeout ends the loop immediately as `infrastructure`; exhausting five
   attempts is `unverified`. Conflating "the model produced bad code" with "the
   model never answered" would corrupt the convergence rate directly.
   - _Fault found and fixed while writing this up:_ `generate` never checked
     `res.ok`, so a non-2xx returned `data.response === undefined`, which threw
     a `TypeError` inside `stripFences` — a fence-stripping function detecting a
     transport fault. The outcome was right by accident and the transcript named
     the wrong cause. It is now raised where the status is known.

## Week 8 — 2026-08-04 — controlled test of the feedback preamble

**Done:** the paired run that limitation 2 of the previous entry called for,
executed immediately rather than deferred. Artefacts in
`tests/fixtures/runs/2026-08-04-preamble-paired/`.

Two arms, differing in one line of the user prompt and nothing else. Arm A sends
DDL + the framing sentence "Your previous attempt at this task was rejected by
an automated check." + Agent 3's critique. Arm B sends DDL + the critique. Same
seed candidate, same DDL, same system prompt, same `temperature: 0, seed: 42`.

| | seed | arm A (with preamble) | arm B (critique only) |
| ------------------ | ---- | --------------------- | --------------------- |
| routes             | 13   | **10**                | **13**                |
| chars              | 6 349 | 4 242                | 5 558                 |
| `updated_at` refs  | 2    | 0                     | 0                     |
| latency            | —    | 142 656 ms            | 166 687 ms            |
| verdict            | fail Layer 2 | verified      | verified              |

**Both arms repaired the named defect. Only the arm carrying the preamble
deleted routes.** Arm B removed the invented `updated_at` and kept all three
`order_line_items` routes.

### The previous entry's attribution was wrong, and is corrected here

That entry explains the 13 → 10 route loss as constraint saturation — the model
taking the cheapest path to satisfying a soundness gate, since deleting a route
removes the offending column reference. **That mechanism is still correct about
why the gate cannot catch the loss**, and the design consequence drawn from it
stands: a soundness gate cannot detect deletion, so the deferred coverage score
is load-bearing.

But it is not what triggered the loss. The trigger was the preamble — a sentence
added to the prompt on my own judgement, never justified by evidence, and
identified as an uncontrolled variable only after the run it contaminated. The
critique alone repairs without collateral damage on this input. The earlier
entry presented a prompt artefact as a property of feedback-driven repair, and
that reading would have gone into Chapter IV unchallenged had the variable not
been flagged.

Recording it this way round rather than editing the earlier entry, on the same
principle as the Layer 2 correction: the claim is corrected where it is
disproved, not quietly satisfied.

### Determinism now established across processes, not assumed

Arm A reproduced the module recorded earlier the same day **byte-for-byte**
(`sha256 799ad20a…`), in a separate process on a separate invocation.

This had been assumed from the Week 7 Agent 1 result and a within-session Week 8
check, and the whole re-prompting argument depends on it: if generation were not
deterministic, the loop would be retrying rather than re-prompting, and no
difference between attempts could be attributed to the feedback. It is now
tested for Agent 2 across process boundaries.

It also upgrades what the paired run can claim. Because generation is
deterministic, the arm A / arm B difference **cannot be sampling noise** — the
only varying input was the preamble. Within this case the attribution is causal,
not correlational.

### Technical limitations

1. **One input. The result is clean, not general.** One schema, one defect class
   (Layer 2 / `UnknownColumn`), one critique, one comparison. Determinism rules
   out noise *within* this case; it says nothing about whether the preamble
   harms on the blog schema, on a Layer 1 syntax repair, or on a different
   critique. The honest claim is "on this input the preamble caused the
   deletion", not "the preamble is harmful".
   - _Next:_ the same pair on `blog-schema.sql`, and on `v5-orders` so the
     Layer 1 repair path is exercised live for the first time.

2. **The preamble default is unchanged pending that evidence.**
   `DEFAULT_FEEDBACK_PREAMBLE` still carries the sentence; omitting it is
   `preamble: null`. Flipping the default on a single observation would repeat
   the error that produced the sentence in the first place — a prompt decision
   taken on judgement rather than evidence. The parameter exists so the question
   stays answerable; the answer needs more than n = 1.
   - _Standing risk while it stays:_ every live run recorded until it is settled
     carries a variable known to affect output on at least one input.

3. **Why the preamble might cause deletion is not established.** A plausible
   reading is that framing the turn as a rejection shifts the model toward
   producing something minimal and safe, and that this competes with the route
   set for the same instruction-following capacity (limitation 1 of the Agent 2
   entry). **That is a hypothesis with no evidence behind it.** What is measured
   is that the sentence changes the output; the reason is not.

4. **`chars` and `routes` disagree about which repair is "smaller".** Arm B is
   larger than arm A (5 558 vs 4 242) and also more complete (13 vs 10 routes),
   so on this input output size tracks completeness. Do not read `outputChars`
   as a quality signal in either direction — `routeCount` is the field that
   answered this question, and it only exists because the earlier run's loss was
   invisible without it.

## Week 8 — 2026-08-04 — Layer 1 syntax repair, live for the first time

**Done:** the `v5-orders` paired run. Artefacts in
`tests/fixtures/runs/2026-08-04-preamble-paired-v5-orders/`. Same two-arm design
as the `v4-orders` pair; the seed fails Layer 1 rather than Layer 2, so this is
the first time the syntax-repair path has run against the live model at all.

| | seed | arm A (preamble) | arm B (critique only) |
| ----------------------- | ----- | ----------------- | --------------------- |
| generations to converge | —     | **1**             | **1**                 |
| latency                 | —     | 248 800 ms        | 227 444 ms            |
| chars                   | 5 858 | 7 210             | 7 219                 |
| routes                  | 13    | 15                | 15                    |
| verdict                 | fail Layer 1 (`SyntaxError`) | verified | verified |

**Syntax feedback repairs, and this was not a given.** The critique is a caret
excerpt pointing at `["$" + (i + 1) for (i in cols)]` — a legacy array
comprehension valid in no current dialect. Unlike the schema critique, which
names a column to delete and lists the legal alternatives, this one identifies a
construct the model must *replace* with something it has to invent. Both arms
did so on the first repair. The design decision to render the offending line
with a caret inside Layer 1, rather than return a bare line number for a driver
to reassemble, is now supported by a live result rather than by argument alone.

**Both arms also fixed the `order_line_items` misclassification**, unprompted.
It has a `SERIAL PRIMARY KEY`, so under Agent 2's own prompt it is a resource;
the seed nested it under `/orders` as though it were a join table. Both repairs
promoted it to five top-level routes — 5 × 3 tables = 15. The previous entry
recorded that misclassification as predating the loop and unaddressed; on this
input the repair corrected it as a side effect.

### The repair broke a rule the seed obeyed, in both arms

Rule 1 of Agent 2's system prompt: *"PUT handlers are always written with a
fixed SQL string… never build a PUT's SET list with .map or .join."*

| | seed | arm A | arm B |
| ------------------------------------- | ---- | ----- | ----- |
| `setClause` built with `.map().join()` | 0    | 6     | 6     |
| hardcoded `status = '…'` writes in PUT | 0    | 0     | **2** |

The seed obeyed it exactly. Both repairs replaced the fixed string with a
dynamically assembled SET clause. Arm B additionally appended a literal
assignment, so every `PUT /customers/:id` resets `status` to `'active'` and
every `PUT /orders/:id` resets it to `'pending'`, whatever the request said.

**Both modules were returned as `verified: true`, correctly.** They parse, and
`status` is a real column. Neither layer asserts anything about obeying the
system prompt or about writing a column the caller never mentioned.

This is constraint saturation (limitation 1 of the Agent 2 entry) arriving
through a new door. Previously it appeared across prompt *versions* — adding a
rule cost another. Here it appears across *attempts within one version*: the
model spends its instruction-following capacity on the correction and drops a
rule it had previously satisfied, with the system prompt unchanged.

### Correction to the preamble finding — the evidence is now split

The previous entry showed the preamble causing route deletion on `v4-orders`,
and concluded it was an unforced addition with one controlled result against it.
This run does not replicate that, and cuts the other way:

| pair | arm A (preamble) | arm B (critique only) | worse arm |
| ------------ | ---------------- | --------------------- | --------- |
| `v4-orders` (Layer 2) | 10 routes, 3 deleted | 13 routes, intact | **A** |
| `v5-orders` (Layer 1) | rule 1 violated | rule 1 violated **+ 2 forced status writes** | **B** |

One controlled result each way. The plan recorded after the first pair — run
this pair, then remove the preamble and date the change — was conditional on the
evidence pointing one way. It does not, so **the default is unchanged and the
question is reopened rather than closed.**

The structural argument for removal still stands on its own: the preamble is an
intervention that was added on judgement and has never had evidence *for* it,
and "critique alone" is the baseline that needs no justification. That argument
is unaffected by this run. What this run removes is the empirical support for
acting on it now, which was a single observation and is now contradicted by a
second.

### Technical limitations

1. **Collateral damage from a repair is not preamble-specific.** The route
   deletion appeared in one arm; the rule-1 violation appears in both. The
   general statement is that a repair regenerates the whole module and can lose
   constraints the previous attempt satisfied — the preamble may modulate which
   constraint is lost, but is not required for loss to happen.
   - _Consequence:_ **this can produce a wrong verdict.** Arm B is emitted as
     `verified: true` while silently overwriting `status` on every update. That
     is worse than the defect the loop was repairing, and it is exactly the
     false-pass class Agent 3 exists to prevent — reached by a route the gate
     does not cover.

2. **Neither layer asserts conformance to the system prompt.** Rule 1 is stated
   in the prompt, was obeyed by the seed, and is violated by both repairs
   without any layer objecting. A gate for it would be structural (is the PUT
   SQL a `Literal` rather than a `TemplateLiteral`?) and is cheap on the AST
   Layer 1 already produces.
   - _Open question:_ whether prompt conformance belongs in the verifier at all,
     or whether it is a measurement of the prompt rather than of the code. Not
     resolved here.

3. **A written column that the caller never supplied is invisible to Layer 2.**
   `status = 'active'` references a real column, so soundness holds. The defect
   is that the value is fabricated, which is an assertion about the relationship
   between the request and the statement — the same shape as the `v5-blog`
   `req.body`/`req.params` defect already recorded as unbuilt.

4. **Two pairs, two schemas' worth of nothing.** Both pairs use
   `orders-schema.sql`. The blog schema has not been paired at all, so nothing
   here separates "property of the model" from "property of this schema".

## Week 9 — 2026-08-10 — decisions recorded before the experiments they govern

**Done:** no code. This entry fixes four methodology decisions in writing
*before* the runs and the parser that they constrain exist. The reason for the
ordering is the one the whole evaluation rests on: a measure chosen after
seeing output is not a measure, and every one of these four could otherwise be
settled retrospectively in whichever direction flattered the result.

### The baseline is the same local model, not a premium cloud model

§2.8 as submitted defines the baseline as *"a single call to a premium model"*.
Changed to **a single monolithic call to `qwen2.5-coder:7b`** same model, same
`temperature: 0`, same `seed: 42`, same hardware as the pipeline arm.

The research question asks whether a *pipeline* of small local agents plus a
deterministic verifier outperforms *a single monolithic language model*. That is
a claim about the harness. A cloud frontier baseline varies model capability and
harness simultaneously, so whichever arm won, the result could not be attributed
to either factor and the likely outcome, a frontier model winning, would say
nothing about the contribution this dissertation makes. Holding the model
constant leaves the harness as the sole independent variable.

Two costs are accepted deliberately. The comparison sounds weaker: "beats one
prompt to the same 7B model" is a narrower claim than "beats GPT-class". And it
says nothing about whether a frontier model would have been a better engineering
choice, which is a real question this design cannot answer. The narrow claim is
taken because it is the one that survives examination. The alternative also
breaks the zero-token-cost argument §2.7.1 already makes and would need that
section rewritten.

**The submitted §2.8 was already internally inconsistent on this point**, which
is the strongest evidence that the premium baseline was a leftover rather than a
considered design. The same paragraph states that "for each trial, telemetry is
collected natively from the Ollama runtime". Ollama cannot report token counts
for a call it did not serve, so under a cloud baseline metric 5 (token
consumption, both arms) is unmeasurable without a second telemetry path that was
never specified. Option A does not merely avoid a confound; it repairs a
contradiction that was already in the chapter.

§2.7.1 needs no rewrite under this choice. Its cost and privacy arguments concern
deployment economics, cite DIN-SQL rather than this project's own results, and
are unaffected by what the baseline arm runs. What it gains is that its third
bullet, that 7B models are more error-prone *when prompted monolithically*,
stops being an assertion and becomes the hypothesis the baseline arm tests.

### Ten trials, scoped to latency, because output is invariant by configuration

§2.8 as submitted promises ten independent trials per scenario reporting
variance and standard deviation. Under greedy decoding with a fixed seed that
promise is empty: two prior observations in this logbook establish
byte-identical output across runs Week 7 limitation 3 (`diff` exit 0 on two
fresh runs) and *"Determinism now established across processes, not assumed"*
(2026-08-04). Ten trials would report a standard deviation of exactly zero on
every output metric, measuring the decoding configuration rather than the
system.

§2.8 is therefore restated: generation is deterministic by configuration, so
output metrics are invariant across repetitions and are reported from a single
run; **latency** is reported as a mean and standard deviation across **ten
repetitions of a defined representative subset**.

The subset is defined here rather than at run time, so that it cannot be chosen
after the timings are seen: **Scenario B** both feature-description fixtures,
blog and orders. **Scenario A** the first ten instances of the Spider
subset by index.

This is a narrowing of what is measured, not of rigour the discarded
repetitions were uninformative, and the finding that licenses discarding them is
the project's own. It is written here in that order so the claim is auditable.

### The published grammar in §2.5.1 accepts none of the real fixtures

Established by reading, before writing any parser. The EBNF printed in §2.5.1
admits only `PRIMARY KEY` and a `FOREIGN KEY REFERENCES <table> (<col>)`
constraint on a bare `<col_name> <data_type>` column. Against the two DDL
fixtures Agent 1 actually produced:

| construct | in published grammar | in `blog-schema.sql` | in `orders-schema.sql` |
| ---------------------------- | --- | --- | --- |
| `SERIAL`                     | no  | yes | yes |
| `NOT NULL`                   | no  | yes | yes |
| `UNIQUE`                     | no  | yes | yes |
| `DEFAULT <expr>`             | no  | yes | yes |
| `CREATE TYPE … AS ENUM`      | no  | yes | yes |
| `CHECK (…)`                  | no  | no  | yes |
| `NUMERIC(10, 2)`             | no  | no  | yes |
| inline `REFERENCES t(c)`     | no  | no  | yes |
| table-level `FOREIGN KEY (c) REFERENCES t(c)` | no see below | yes | no |

Acceptance rate of the grammar as published: **0 of 2**. Separately, its FK
production is `"FOREIGN KEY REFERENCES" <table_name> "(" <col_name> ")"`, which
is not valid PostgreSQL in any form the constraint requires the local column
list, `FOREIGN KEY (author_id) REFERENCES users(id)`. So the published rules do
not merely under-cover the observed output; one of them describes a construct
the database would reject.

**Decision:** Layer 0 implements an **extended** grammar covering the constructs
Agent 1 emits, and §2.5.1 prints the extended rules with a statement that the
grammar was extended during implementation to match observed output. The
acceptance rate of the originally published subset is reported **separately, as
the 0/2 figure above**, so the coverage gap is on the record rather than
quietly repaired.

The alternative implement exactly what was printed and report the gap as a
limitation was rejected on a functional ground, not a presentational one. A
Layer 0 that rejects every real run cannot serve as a gate; it would route every
generation into an Agent 1 repair loop that has nothing to repair. What is not
defensible under either option is implementing a grammar different from the one
the thesis prints, and this entry exists so that cannot happen silently.

### Layer 0 runs before the Agent 2 loop, not inside `verify()`

The DDL is fixed for the whole duration of the Agent 2 loop
(`src/reflect.js` loops on `ddl` unchanged), so checking it inside
`verify(code, ddl)` would re-run an identical check on every attempt and would
leave `reflect()` to work out which agent a failure belongs to.

Layer 0 therefore runs once on the DDL, in its own bounded Agent 1 repair loop,
before the Agent 2 loop is entered. `src/verify.js` keeps its present meaning
judge this module against this DDL and the two reflection paths stay
structurally distinct: **Layer 0 → Agent 1**, **Layers 1 and 2 → Agent 2**. That
distinction is what §2.6.1 and §3.6 have to describe, and it is easier to
describe when the code has the same shape as the description.

This is an addition to the loop architecture, not a rewrite of it. §2.6 as
submitted describes a single loop over Agent 2 and does not survive unamended.

### The corrections actually applied to Chapters I and II

The model referenced throughout the submitted chapters was `8B`; the model every
run in this logbook used is `qwen2.5-coder:7b`. **18 search hits, all replaced.**
One of the 18 is the auto-generated table of contents mirroring the §2.7.1
heading, so 17 distinct passages were touched.

Two defects in §2.8 were repaired in the same pass. The metric list was numbered
4 to 8 and is now 1 to 5. Metric 4 was corrupted in the submitted file, reading
"wall-clock duration from text ingestion to archive serialis database's
shipsation, in milliseconds"; it now states wall-clock elapsed time from
ingestion of the natural-language input to serialisation of the output archive.

The metric-4 wording describes a measurement the artefact cannot yet take. The
archive is produced by the web application layer, which does not exist, and `reflect()`
currently times each generation rather than the run. **The instrumentation must
be built to match this definition, or the reported figure will not be the figure
§2.8 defines.** Recorded here because that mismatch would otherwise surface in
Chapter IV, too late to fix.

The chapter file lives in OneDrive and is saved as a new version; the submitted
`v2` is not renamed or overwritten.

### Technical limitations

1. **A same-model baseline cannot answer the question a reader will actually
   ask.** "Would a frontier model have done this in one call?" is the practical
   question, and this design is silent on it by construction.
   - _Cause:_ the choice to isolate the harness by holding the model constant.
   - _Residual risk:_ an examiner may read the narrow comparison as evasion. The
     defence is the confound argument above, and it has to be made explicitly in
     Chapter IV rather than left for them to reconstruct.

2. **The representative subset is defined but not yet justified as
   representative.** "Both fixtures" and "first ten by index" are reproducible
   selection rules, which is what the pre-registration requires; neither is an
   argument that those instances resemble the rest.
   - _Consequence:_ latency variance is reported for a *stated* subset, and must
     be described that way rather than as the variance of the system.

3. **Determinism is a property of this configuration, not a guarantee.** Carried
   forward from Week 7 limitation 3: byte-identical output holds for this model
   tag, this Ollama version, this hardware. Every result that rests on
   single-run reporting inherits that dependency.
   - _Mitigation:_ pin the model tag before any figure is treated as fixed.

4. **The 0/2 acceptance figure is computed against two fixtures.** It is a
   statement about the two DDL scripts in `tests/fixtures/`, not an estimate of
   how often the published grammar would reject Agent 1 output in general. The
   Spider run will produce a hundred more DDL scripts and is the first
   opportunity to replace this figure with one that means something.

5. **The sweep count is a search result, not an audit.** 18 hits is what the
   document's own search reported; nothing independently confirms that every
   hit was a model-size reference or that no variant spelling was missed.
   - _Residual risk:_ a stray "8-billion" written out in words would not appear
     in a search for `8B`. Cheap to re-check before submission, and worth doing
     once rather than trusting this figure twice.

## Week 9 — 2026-08-11 — Agent 3 Layer 0, the grammar check on Agent 1's DDL

**Done:** `src/agents/grammarVerifier.js`, a recursive-descent parser with an
explicit parenthesis stack, and `src/synthesise.js`, the Agent 1 repair loop that
gates on it. Until now nothing validated Agent 1's output at all: Layer 1 parses
JavaScript, and Layer 2 reads the DDL lexically while assuming it is well formed,
which Week 7 limitation 1 already recorded as unsafe. 101 assertions across the
suite, all passing.

The parenthesis stack is not decoration. It is the justification §2.5.1 gives for
a context-free rather than a regular grammar, and `NUMERIC(10, 2)` inside a
column list inside a table body is the construct that puts the problem beyond a
regex. It can be pointed at in the code if an examiner asks.

### Both grammars, measured

The parser runs in two modes over the same input from one code path, so the two
acceptance rates are comparable rather than merely both reported.

| fixture | published §2.5.1 | extended |
| --- | --- | --- |
| `blog-schema.sql`   | fail line 1: `Expected TABLE after CREATE, found "TYPE"` | **pass**, 4 tables |
| `orders-schema.sql` | fail line 1: `Expected TABLE after CREATE, found "TYPE"` | **pass**, 3 tables |

**Published grammar: 0 of 2.** This confirms by execution the figure the 2026-08-10
entry established by reading.

Both fixtures fail on the same first construct, `CREATE TYPE ... AS ENUM`, which
hides how much else is unsupported. Removing the `CREATE TYPE` statements and
re-running moves the failure to the first `NOT NULL` in each file. So the
published grammar does not fail these fixtures at one point; it fails at the
first of several, and the count of distinct unsupported constructs is larger
than the count of reported errors. That distinction matters for how the coverage
gap is described in §2.5.1: it is not "one missing production".

### The published grammar misattributes its own failure

Removing `CREATE TYPE` and re-running reports **`UnclosedParenthesis` at line
1**, pointing at the `(` that opens the table body. The parser is correct about
its state — that parenthesis is genuinely never closed from its point of view —
and wrong about the cause, which is the unsupported `NOT NULL` fifteen tokens
later. It stops recognising column definitions, so the `)` it eventually meets
is unreachable.

This is worth recording because the feedback string is the entire mechanism of
the repair loop. A critique that names the wrong construct sends Agent 1 to fix
a parenthesis that is not broken. Under the extended grammar the situation does
not arise on current fixtures, but the failure mode is structural rather than
incidental: **any unsupported construct inside a table body surfaces as an
unclosed parenthesis**, because the parser cannot distinguish "this is not a
column definition" from "the list ended early".

### Layer 0 and Layer 2 agree, and that is now asserted

Both readers extract identical table and column sets from both fixtures, checked
per table rather than in aggregate. Layer 2's reader is a lexical scan with a
documented list of things it does not understand; Layer 0's is structural. The
agreement is a test result, not a shared implementation — they remain two
independent readers of the same input.

The reason this is a correctness requirement rather than a tidiness one: if
Layer 0 accepts a DDL that Layer 2 then reads short by one column, Layer 2
reports a real column as invented. That is a false failure in the expensive
direction, and it sends Agent 2 into a ~200 s repair loop to fix code that was
correct, with an error message pointing at the routes rather than at the
disagreement.

### The second reflection path

Layer 0 runs once on the DDL before the Agent 2 loop is entered, in its own
bounded loop, rather than inside `verify()`. The DDL does not change for the
whole duration of the Agent 2 loop, so checking it there would re-run an
identical check on every attempt and leave `reflect()` to decide which agent a
failure belongs to. In `src/synthesise.js` the answer is structural: whatever
fails there was produced by Agent 1.

Both loops keep the same conventions — attempt cap, single latest critique never
an accumulation, emit nothing on exhaustion, infrastructure failure typed
separately from verification failure. Those were argued once in `reflect.js` and
re-deciding them differently here would have made the chapter describe two
conventions instead of one.

`synthesiseSchema` gained the `feedback` parameter it never had. Without it the
loop would re-send the description unchanged, and under `temperature: 0` with
`seed: 42` that returns byte-identical broken DDL until the cap — a loop that
consumes five generations while appearing to work. The loop tests inject a
generator and cannot see this, so it is covered by a separate test on the prompt
builder.

### Technical limitations

1. **Nothing here has met the live model.** Every result above is against two
   recorded fixtures and injected generators. Whether Agent 1 can act on a Layer
   0 critique is unanswered, and it is a different question from whether Agent 2
   could act on a Layer 1 critique — the DDL grammar critique names a construct
   to remove, not a syntax error to replace.
   - _Consequence:_ the convergence behaviour of this loop is currently
     **unmeasured**. A live paired run is the next thing this needs.

2. **CHECK expressions are balanced, not parsed.** `CHECK (quantity > 0)` is
   accepted as a parenthesis-balanced run of tokens. Balance is the property
   this layer owns and the published grammar contains no expression production,
   so implementing one would be inventing grammar the thesis does not print.
   - _Residual risk:_ `CHECK (quantity >>> 0)` is accepted. Layer 0 asserts the
     statement is well formed, not that it is meaningful.

3. **A hand-written parser for a grammar subset is not a PostgreSQL parser.**
   Not understood: `ALTER TABLE`, views, indexes, multi-word type names
   (`DOUBLE PRECISION`, `TIMESTAMP WITH TIME ZONE`), array types, schema-
   qualified names, `GENERATED ... AS IDENTITY`, and deferrable constraint
   clauses.
   - _Consequence:_ each of these is a **false failure** — valid PostgreSQL that
     Agent 1 could legitimately emit and this layer would reject, sending it
     into a repair loop for correct output. This is the more expensive error
     direction, and it is the direction this parser errs in by construction.
   - _Mitigation:_ the Spider run over 100 generated schemas is the first
     sample large enough to say how often it happens. Until then the rate is
     unknown, not low.

4. **The extended grammar was written against two fixtures.** It covers what
   Agent 1 emitted on a blog schema and an orders schema. Treating it as "what
   Agent 1 emits" generalises from n=2, and limitation 3 is the list of ways
   that generalisation can be wrong.

5. **TDD was not followed uniformly.** The contract assertions, the two grammar
   modes, the cross-reader agreement, the whole Agent 1 loop, and the prompt
   builder were each written as failing tests first and watched fail. The four
   error-type cases were not: the parser already distinguished them when those
   tests were written, so they passed on first run and prove only that the
   behaviour exists, not that the tests can detect its absence.
   - _Consequence:_ those four are the weakest tests in the file. If the error
     taxonomy matters to a later result — and it does, since the Spider evaluation records the
     Layer 0 error type per instance — they should be re-derived by breaking the
     parser deliberately and confirming each test fails.

## Week 9 — 2026-08-11 — Layer 0 meets the live model, and fails 37.5% of it

**Done:** a paired live probe either side of a grammar extension. Artefacts in
`tests/fixtures/runs/2026-08-11-layer0-live/` (before, committed unchanged
before the parser was touched) and `.../2026-08-11-layer0-live-after/`.

Eight descriptions: three controls in the domains the Week 8 fixtures came from,
five probes written to invite PostgreSQL types the extended grammar did not
cover. The probes were deliberately not written to produce *bad* SQL. They were
written to produce *good* SQL the parser might reject, because the previous
entry's limitation 3 stated the parser errs toward false failures and that the
rate was unknown.

| | before | after |
| --- | --- | --- |
| extended grammar accepted | 4 / 8 | **7 / 8** |
| false failures | **3 / 8 (37.5%)** | **0 / 8** |
| true positives | 1 | 1 |
| published grammar accepted | 0 / 8 | 0 / 8 |

### The question was reframed before the run, and that was the whole value

The intention was to test whether Agent 1 can act on a Layer 0 critique. Reading the
code first changed the question: on the existing fixtures Agent 1 already passes,
so the more likely live failure was never Agent 1 producing bad DDL — it was
Agent 1 producing good DDL this parser rejects. **How often the critique is
wrong matters more than whether the model can act on it**, and it had to be
measured before the Spider evaluation rather than after.

### Why 37.5% was disqualifying rather than merely imprecise

the Spider evaluation records the Layer 0 verdict across 100 Spider schemas and, if Layer 0 gates,
routes failures into an Agent 1 repair loop. At that rate roughly a third of
instances would be re-prompted to correct SQL that was already correct. The
resulting **mean-iterations-to-convergence** figure is metric 3 of §2.8 and is
evidence for the research question in Chapter IV: it would have measured this
parser's coverage gaps while being reported as the model's ability to repair
itself. That is a measurement of the wrong thing, not a noisy measurement of the
right one.

### The true positive justifies the layer on its own

On `c1-blog` — a **control**, a plain blog description, no adversarial
prompting — Agent 1 emitted:

```sql
CREATE TYPE tag_name AS VARCHAR(255);
```

PostgreSQL has no `CREATE TYPE <name> AS <basetype>` form. The parenthesised
variants are composite, `ENUM` and `RANGE`; a type over an existing base type is
`CREATE DOMAIN`. This statement does not execute.

**No other layer could have caught it.** Layer 2 reads column names out of
`CREATE TABLE` bodies and never inspects a type declaration; Layer 1 never sees
the DDL at all. Without Layer 0 this schema reaches Agent 2, which writes routes
against a column whose type does not exist, and the failure surfaces at runtime
against a real database — which is precisely the class of defect this project
claims a deterministic verifier removes. Found on an unprompted control rather
than a hand-picked fixture.

It also survived the extension by design. The forms accepted after `AS` are an
explicit whitelist; a fallthrough would have been one line shorter and would have
thrown the finding away.

### The critique improved, and that is a separate result

```
- Expected ENUM after AS at line 1, column 24:
+ Expected ENUM, RANGE, or ( after AS, found "VARCHAR". A type over an existing
+ base type is CREATE DOMAIN, not CREATE TYPE at line 1, column 24:
```

The first names what the parser wanted; the second names what the model did
wrong and what the right construct is. Only the second is actionable. Whether
Agent 1 acts on it is still untested — the original question, still open, now
resting on a critique worth testing.

### Design decision: indexes are parsed, not skipped

`CREATE INDEX` could have been skipped to the next semicolon in one line.
Skipping would accept `CREATE INDEX idx ON d (id;` — a malformed statement
passing the gate, which is the false-pass class this agent exists to prevent,
reached by the cheaper implementation rather than by any trade-off. It is parsed
structurally instead, and `tests/layer0.test.js` asserts the malformed form still
fails.

### Determinism, on eight descriptions instead of two

All eight generated schemas are **byte-identical** between the two runs, in
separate processes. Prior evidence rested on two fixtures; this extends it to
eight domains and is what §2.8's single-run reporting of output metrics now
stands on. Latency was not identical — the cold-start case moved 47 748 → 38 687
ms, the rest by under 2% — the same independence of timing and decoding recorded
in Week 7, observed in the opposite direction.

### Technical limitations

1. **Zero false failures on eight descriptions is not a false-failure rate.**
   The extension was written against the three failures this sample produced, so
   the sample cannot also validate it. 0/8 here means "the known gaps are
   closed", not "no gaps remain".
   - _Mitigation:_ the 100 Spider schemas are the first independent sample.
     The Layer 0 verdict must be recorded there under both grammars, and the
     false-failure rate re-derived by reading the rejections rather than assumed
     from this number.

2. **Schema-qualified names still fail.** `REFERENCES public.accounts(id)` is
   rejected. The `.` is tokenised, but qualified names are not parsed, and this
   is deliberate: Layer 2 reads an unqualified table name out of the same DDL,
   so teaching only Layer 0 about qualification would break the cross-reader
   agreement that is asserted as a correctness requirement. Closing it means
   changing both readers together.

3. **Parenthesised constructs are checked for balance, not meaning.** Composite
   type bodies, `CHECK` expressions, index column lists and row-constructor
   defaults are all consumed as balanced token runs. `CHECK (amount.amount >>> 0)`
   passes. Layer 0 asserts well-formedness, and the thesis publishes no
   expression production to implement instead.

4. **The probe descriptions are mine, not sampled.** Five of eight were written
   specifically to stress type coverage, so the 37.5% before-figure is a
   property of a deliberately adversarial sample and is not an estimate of the
   rate on natural input. What it establishes is that the rate was **high enough
   to disqualify the gate**, not that it was 37.5% in general.

5. **The working estimate for a 100-instance evaluation is wrong.** 8–10 minutes
   was derived from the 4 724 ms Week 7 median, measured on a one-table `users`
   prompt. These eight average 17.3 s including a cold start,
   14.2 s excluding it, so 100 instances is **roughly 25–30 minutes** of
   generation before any repair loops.

## Week 9 — 2026-08-12 — Spider metric specification, written before the run

**Done:** no results. This entry fixes the scoring rules, the sample and the
input construction **before a single instance is generated**, because every one
of them could otherwise be chosen after seeing the scores. Nothing below was
decided with any generated DDL in view.

Three defects in the evaluation design as originally scoped were found while
preparing this, and are recorded here rather than silently fixed.

### Defect 1: the dev split cannot supply 100 instances

The design assumed the sample could be "the first 100 instances by index after
sorting by `db_id`" from the 1,034-instance dev split. **The dev split contains 1,034 questions but
only 20 distinct databases.** Agent 1 synthesises one schema per *database*, so
that rule would have generated 20 schemas about five times each — byte-identical
repeats under `temperature: 0` and `seed: 42` — and then counted the same schema
up to eight times in a pooled precision figure.

**Rule as fixed:** every database in the Spider release (`tables.json`, 166
databases), sorted by `db_id` ascending, first 100 taken. Saved to
`tests/spider/subset-100.json` with the rule text.

The train/dev distinction is not preserved and does not need to be: it exists to
prevent test leakage for *trained* semantic parsers, and nothing here is trained.
§2.8's "drawn from the development split" needs one clause changed to say the
database collection of the release.

### Defect 2: Spider supplies questions, not feature descriptions

The gold standard is each database's schema, but the natural-language input has
to come from somewhere. Three constructions were considered and the choice is
recorded because it determines what the experiment measures:

- **db_id alone** — no leakage but almost no information; recall would be low
  and uninformative.
- **db_id plus gold table names** — rejected outright. The answer would be
  inside the prompt and the result would measure transcription.
- **db_id plus its first five Spider questions** — chosen. The questions state
  what the system must answer without naming tables, so structure is inferred
  rather than copied.

**Rule as fixed:** humanised `db_id` (underscores to spaces, trailing numeric
suffix dropped), then the first five questions for that database in dataset
order. Every description is saved verbatim to `tests/spider/descriptions-100.json`
so the run is reproducible from the repository alone.

### Defect 3: three databases have no questions in the distributed dataset

`academic`, `geo` and `imdb` come from Spider's `train_others` file, which the
`xlangai/spider` distribution does not carry. They receive the db_id sentence
alone.

**They were not swapped out.** Replacing sample members after the selection rule
is fixed is the exact manipulation the pre-registration exists to prevent. They
stay in, are flagged `fallback: true`, and their scores are reported separately
so the weaker prompt is visible rather than averaged away.

### The metric specification

1. **Unit.** One database is one instance. n = 100.

2. **What is scored.** Tables, columns, column types and foreign keys extracted
   from the generated DDL by `parseSchema` (`src/agents/relationalValidator.js`),
   the lexical reader, applied uniformly. It is used rather than Layer 0's
   structural map because it returns a schema even for DDL that fails to parse,
   which keeps "unparseable" and "wrong" as separate measurements instead of
   collapsing one into the other.

3. **Layer 0 is recorded, not applied.** Every instance is parsed under **both**
   the published and the extended grammar and both verdicts are recorded with the
   error type. Layer 0 does **not** gate this run and no repair loop is entered:
   this experiment measures single-pass schema synthesis, and gating would
   confound it with repair. Disagreements between Layer 0's map and
   `parseSchema`'s are counted and reported.

4. **Gold standard.** `tables.json` from `taoyds/test-suite-sql-eval`, the Spider
   authors' own evaluation repository, committed to `tests/spider/tables.json`.
   The synthetic `*` column at index 0 of `column_names_original` is excluded.

5. **Table matching — computed twice, reported separately.**
   - *exact:* case-insensitive string equality.
   - *normalised:* lowercased, underscores removed, and a trailing regular
     plural (`-s`, `-es`) stripped from both sides, so gold `singer` matches
     generated `singers`.

6. **Column matching.** The same two rules, applied **only within a matched
   table**. A column in an unmatched table is unmatched by construction.

7. **Precision and recall.** Precision = matched ÷ generated. Recall = matched ÷
   gold. Reported **macro** as the headline — computed per instance, then
   averaged unweighted — because the unit of interest is a generated schema and
   the subset ranges from 2 to 26 tables, so pooling would let the largest
   schemas dominate. **Micro** (pooled across all instances) is reported
   alongside. Instances that produce no parseable schema score 0 for recall and
   are excluded from precision, since precision over zero generated elements is
   undefined; the count of such instances is reported.

8. **Foreign keys.** A gold foreign key is a directed
   (table, column) → (table, column) pair. A generated key matches only when
   **both** endpoints match under the table and column rules in force, and the
   direction agrees.

9. **Data types.** Scored only over matched columns. PostgreSQL types are mapped
   to Spider's five categories:

   | Spider category | PostgreSQL types |
   | --- | --- |
   | `number`  | INT, INTEGER, SMALLINT, BIGINT, SERIAL, BIGSERIAL, NUMERIC, DECIMAL, REAL, FLOAT, DOUBLE PRECISION, MONEY |
   | `text`    | CHAR, VARCHAR, CHARACTER, CHARACTER VARYING, TEXT, UUID, and user-defined ENUM types |
   | `time`    | DATE, TIME, TIMESTAMP, TIMESTAMPTZ, INTERVAL |
   | `boolean` | BOOLEAN, BOOL |
   | `others`  | everything else, including JSON, JSONB and array types |

   Type accuracy = matched columns whose mapped category equals the gold
   category ÷ matched columns.

10. **3NF is dropped from metric 1.** §2.8 promised "correctly generated 3NF
    tables". Spider's schemas carry no normalisation guarantee, so they cannot
    serve as a 3NF gold standard, and scoring against them for it would measure
    nothing. The claim is removed from the metric and §2.8 must say why. Agent
    1's 3NF instruction remains in its system prompt as a design choice; it is
    simply not a scored quantity.

### Technical limitations

1. **The subset is alphabetical, so it spans `academic` to `musical` only.** The
   rule is reproducible and was fixed in advance, but the domain coverage is
   incidental rather than engineered, and the second half of the alphabet is
   absent. A random sample under a fixed seed would have been equally
   reproducible and more representative; this is a weakness of the rule chosen,
   stated rather than hidden.

2. **Recall is bounded by what five questions can imply.** A gold table nothing
   in the five questions touches cannot reasonably be inferred, so recall is
   measuring inference from a partial specification, not omission by the model.
   The number will look low and must be read that way.

3. **Normalised matching will over-credit in at least one direction.** Stripping
   a trailing `s` conflates a genuine plural with a distinct name — gold
   `address` versus generated `addres` would match. Reporting exact alongside
   normalised is what makes the size of that effect visible.

4. **The type mapping is mine, not Spider's.** Spider does not publish a
   PostgreSQL-to-category mapping, so the table above is a judgement. It is
   fixed here before the run so it cannot be tuned toward a better number.

## Week 9 — 2026-08-12 — the 100-instance Spider run

**Done:** the full evaluation, scored against the specification committed in
`2350a89` before any instance was generated. Artefacts in
`tests/spider/run-2026-08-12/`: 100 generated schemas and `results.json` with a
per-instance record. 100 instances, **52.9 minutes** wall clock.

### Schema correctness

Macro is the headline figure — computed per instance, then averaged unweighted,
per specification item 7. Micro is pooled across all instances.

| | tables P | tables R | columns P | columns R | FK P | FK R |
| --- | --- | --- | --- | --- | --- | --- |
| **normalised, macro** | **55.2%** | **31.0%** | **28.9%** | **11.4%** | **5.7%** | **1.9%** |
| normalised, micro | 50.0% | 25.3% | 25.0% | 8.0% | 5.2% | 1.8% |
| exact, macro | 36.2% | 19.4% | 14.9% | 5.5% | 3.8% | 1.1% |
| exact, micro | 33.7% | 17.0% | 12.9% | 4.2% | 3.1% | 1.1% |

Type accuracy over matched columns: **93.0%** normalised, 93.6% exact.

Every instance produced a parseable schema; none returned nothing. Layer 0's
structural map and Layer 2's lexical reader disagreed on **zero** of 100
schemas, which is the first evidence for that agreement at scale rather than on
two fixtures.

**Naming convention accounts for roughly nineteen points of table precision.**
The gap between exact and normalised — 36.2% against 55.2% — is entirely
singular/plural and underscore variation. That is a measurement of surface form,
not of design, and reporting only one of the two figures would have misdescribed
the result in whichever direction was chosen.

**Foreign keys are where the model fails hardest.** 1.9% recall means the
relational structure of the gold schema is essentially not reproduced, even
where individual tables are. The model tends to invent its own linking tables:
on `aircraft` it produced a `flight` table where gold has `match` and
`airport_aircraft`, so every gold key is unmatchable by construction even though
two of five tables matched.

**Type accuracy is high and should not be read as encouraging.** 93% is computed
over *matched* columns only, and only 11.4% of gold columns match. It says that
when the model finds the right column it usually gives it a sensible type; it
says nothing about the 88.6% it does not find.

### The three fallback instances behaved exactly as predicted

`academic`, `geo` and `imdb` received the db_id sentence alone because the
distributed dataset carries no questions for them.

| | table recall |
| --- | --- |
| the 3 fallback instances | **4.2%** |
| the other 97 | **31.8%** |

Keeping them in the sample and reporting them separately was the right call:
averaging them in would have depressed the headline by a cause that has nothing
to do with the model.

### Layer 0: the published grammar accepts nothing, at n=100

**0 of 100.** The 0/2 and 0/8 readings hold at scale. This is the figure Chapter
IV should cite.

The extended grammar accepted **35 of 100 as run**. Reading the 65 rejections —
which specification item 3 required rather than counting them — gave:

| cause | count | verdict |
| --- | --- | --- |
| `SELECT` statements appended to the schema | 45 | legitimate |
| dollar-quoted `CREATE FUNCTION` bodies | 13 | false failure |
| `INSERT` statements supplying sample data | 5 | legitimate |
| `ON DELETE CASCADE` / `SET NULL` | 2 | false failure |

15 false failures. The grammar was extended for dollar quoting and referential
actions, and **Layer 0 was re-evaluated over the same committed schemas — no
instance was regenerated**, which is why the runner writes every schema to disk
before scoring anything.

**Re-scored: 45 of 100 accepted, and every one of the 55 remaining rejections is
legitimate.** 48 `SELECT`, 5 `INSERT`, and two cases of
`total INT AS (a + b) STORED` — MySQL generated-column syntax, which PostgreSQL
spells `GENERATED ALWAYS AS (...) STORED` and will not execute as written.

### Two findings that only this layer could produce

**The model answers the questions it is shown.** 53 of 100 schemas carried
`SELECT` or `INSERT` statements alongside the DDL. Agent 1's system prompt says
DDL only; the description says *"the system must be able to answer questions such
as…"* and the model obliges by writing the queries. This is a direct consequence
of the input construction chosen in the specification, and it is a measurable
instruction-following failure: **a competing instruction in the user prompt beat
an explicit prohibition in the system prompt on more than half of all
instances**.

**Dialect leakage.** Two schemas used MySQL syntax. Nothing else in the pipeline
would have noticed: Layer 2 reads column names and would have found them
present, and Layer 1 never sees the DDL. The schema would have reached Agent 2,
which would have written correct routes against a table that cannot be created.

### Technical limitations

1. **The re-scored 45/100 is not an independent figure.** The grammar was
   extended using the failures of the sample it is then measured against, which
   is the same objection recorded after the eight-description probe. **35/100 is
   the independent number**; 45/100 describes a parser fitted to this sample.
   Only a fresh sample can produce another honest reading.

2. **Rejecting a script for its trailing SELECT discards usable schema.** In most
   of those 53 cases the `CREATE TABLE` statements are well formed and the
   offending statements follow them. Layer 0 fails the whole script, so as a gate
   it would send Agent 1 to regenerate output that was largely correct. Whether
   the gate should reject or strip is a design question this run raises and does
   not settle; stripping would be a verifier modifying an artefact, which
   §2.4.3 forbids.

3. **Recall measures inference from five questions, not omission.** A gold table
   that none of the five questions touches cannot reasonably be inferred. 31%
   table recall is a statement about a partial specification, and reading it as
   "the model missed 69% of the schema" would be wrong.

4. **The subset is alphabetical and covers `academic` to `musical` only**, as
   recorded before the run. Nothing in the second half of the alphabet is
   represented.

5. **The latency estimate has now been wrong twice.** The first estimate was
   8–10 minutes, the probe-based correction said 25–30, and the run took **52.9
   minutes** — mean 31.7 s per instance, median 28.4 s, range 6.9 s to 80.0 s.
   Multi-table schemas cost far more than the eight-description probe implied,
   and any future estimate should be built from this figure rather than from either
   earlier one.

## Week 9 — 2026-08-13 — the monolithic baseline prompt, recorded before it runs

**Done:** `src/eval/monolithicBaseline.js` and its splitter, with the prompt
fixed and recorded here **before** the comparative run. An examiner will ask
whether the baseline was handicapped, and the only defence is that the prompt was
written down before any result existed.

### The prompt, verbatim

System instruction:

```
You are a backend engineer working with PostgreSQL and Node.js.
```

User prompt, with the feature description substituted:

```
Build the backend for the following feature.

<description>

Return both of these in a single response:

1. The PostgreSQL schema, as CREATE statements.
2. An Express router as one ES module implementing REST endpoints for that
   schema. Query the database with pool.query, using a pg connection pool
   imported from "../db.js".

Put the SQL in a ```sql code block and the JavaScript in a ```javascript code
block.
```

Same model, same `temperature: 0`, same `seed: 42`, same hardware as the
pipeline arm.

### What the baseline is and is not given, and why

**Given:** the task, the target technologies, and the output format. Nothing
else.

**Withheld deliberately:** Agent 1's normalisation instruction, and every rule in
Agent 2's system prompt — five routes per table, the join-table exemption,
parameterised queries, `try`/`catch` with `next(err)`, the status-code table, 404
via `result.rowCount`, the fixed-string PUT, and the DEFAULT-column allowlist for
POST.

Those rules **are** the harness. Supplying them to the baseline would be running
the harness twice and calling one of the runs a control. The research question
asks whether decomposition plus role-specialised prompting plus deterministic
verification beats a single unstructured call, so the role prompts are the
intervention under test and cannot appear on both sides.

The counter-argument is worth stating because it will be raised: a competent
developer might well write "normalised schema" in a single prompt, and its
absence makes the baseline weaker than a careful practitioner's first attempt.
That is accepted. The comparison is against an unstructured call, and the claim
in Chapter IV must be worded as such rather than as a comparison against expert
prompting.

**The one interface detail that is supplied** — `pool.query` against a pool
imported from `../db.js` — is not a quality hint. Layer 2 recognises `pool.query`
calls, so a baseline reaching for a different data-access idiom would present
Layer 2 with nothing to check and would pass trivially. Naming the interface
removes a false pass **in the baseline's favour** and says nothing about how to
write a correct handler.

### Splitting is a measurement, not plumbing

The response contains both artefacts and they must be separated before either
verifier layer can judge them. Two rules were fixed after inspecting real output
from two instances:

- **Multiple SQL blocks are concatenated.** The model narrates and emits one
  fenced block per table; schemas compose, so all of them are the schema.
- **Exactly one JavaScript block is chosen, never concatenated.** Two modules
  joined would duplicate import bindings and fail to parse. The block exporting a
  router is preferred and, among candidates, the longest. The number of blocks
  not chosen is recorded per instance rather than discarded — on `activity_1`
  the second block was a usage example mounting the router in an app.

A split failure is counted as a failure of that instance and never silently
dropped.

### First observation, from two smoke instances

| | pipeline (Agent 1) | monolithic |
| --- | --- | --- |
| `activity_1` | 410 chars, 1 table | 151 chars, 1 table |
| `aircraft` | 994 chars, 3 tables | 136 chars, 1 table |

Latency 113.7 s and 76.6 s; token counts 171 prompt / 768 and 515 completion.
Both split cleanly. Two instances prove nothing, and these are recorded only to
show what was inspected before committing to the full run.

### Technical limitations

1. **The splitter's rules were fixed after seeing two real responses.** They were
   written as failing tests first, but the shapes they handle came from output
   already generated. A response shaped differently from those two may still
   split wrongly, and the per-instance `extraCodeBlocks` count is what makes that
   visible rather than silent.

2. **Choosing the longest router block is a heuristic.** If a model emitted two
   genuine router modules, the shorter would be discarded and its contents would
   never reach the verifier. No instance has done this yet.

3. **The baseline is weaker than expert prompting by construction**, per the
   argument above. It is a control for the harness, not a claim about the best a
   single prompt can do.

## Week 9 — 2026-08-13 — Layer 0 reports scope violations as their own class

**Done:** a `ScopeViolation` error type in `src/agents/grammarVerifier.js`, and
the 100 committed Spider schemas re-classified without regenerating any of them.

**Acceptance is unchanged at 45 of 100.** Nothing that failed now passes. Only
the classification of the 55 rejections moved:

| verdict | count |
| --- | --- |
| accepted | 45 |
| `ScopeViolation` | **53** |
| `UnclosedParenthesis` | 2 |

### Why the old taxonomy was wrong

53 schemas carried trailing `SELECT` or `INSERT` statements. Their `CREATE TABLE`
definitions are well formed and complete; the offending statements follow them.
Reporting that as a syntax error misdescribes the artefact and, worse, produces a
critique telling the model its schema is malformed when the schema is fine. That
sends Agent 1 to repair something that is not broken — the same misattribution
this layer was already caught making with unrecognised constructs.

The feedback string for a scope violation now says the schema itself may be
correct and asks for the definitions alone.

### Layer 0 asserts two properties, not one

This is the substantive change and it belongs in §2.5.1 alongside the
productions, not only in Chapter III:

1. **Well-formedness** — each statement parses under the grammar.
2. **Subset membership** — each statement belongs to the DDL subset.

A response failing the second is not malformed; it contains more than it should.
Both are purely syntactic, deterministic tests on the token stream — the check is
on a statement's leading keyword — so the layer stays inside §2.4.3's constraint
that Agent 3 evaluates artefacts against fixed formal rules and never reasons
about meaning.

The check runs in both grammars before either dispatches, so the
published-versus-extended comparison is unaffected.

### A warning verdict was considered and rejected

The obvious alternative was to let a schema with a trailing query pass with a
warning attached. That would make `passed: true` mean "passed, mostly", which is
the false-pass class this component exists to prevent, and the same defect as
`node --check` reporting success on a module that would not run.

This is now the third independent decision settled by the same principle: the
field is `passed` and not `verified` at Layer 1; exhaustion emits nothing rather
than a best candidate; and a scope violation fails rather than warns. Worth
pointing at once in Chapter V as a single principle applied consistently rather
than three separate choices.

### Technical limitations

1. **Dialect errors are not given a type of their own, deliberately.**
   Distinguishing "valid in another dialect" from "malformed" requires that
   dialect's grammar. A type recognising the one observed MySQL construct while
   missing every other would claim a capability the layer does not have.

2. **Those two cases are reported as `UnclosedParenthesis`, which is not what
   they are.** `total INT AS (a + b) STORED` is MySQL's generated-column syntax;
   PostgreSQL requires `GENERATED ALWAYS AS (...) STORED`. The parser stops
   recognising column definitions at the unknown construct, so the closing
   parenthesis becomes unreachable and the error surfaces there. The type is
   correct about the parser's state and wrong about the cause, and the chapter
   must say so rather than let the label stand as a description.

3. **The verb list is finite and lexical.** `SELECT`, `INSERT`, `UPDATE`,
   `DELETE`, `MERGE`, `WITH`, `EXPLAIN`, `ANALYZE`, `VACUUM`, `BEGIN`, `COMMIT`,
   `ROLLBACK`, `CALL`. A non-DDL statement opening with anything else would fall
   through to the ordinary parse and be reported as malformed.

## Week 9 — 2026-08-13 — how the baseline arm will be reported, fixed before the result

**Written with 7 of 100 instances answered and no aggregate in existence.** The
split-failure count is unknown at the time of writing, which is the point: the
reporting rule cannot be chosen by the number it will produce.

### The rule

**The headline denominator for both arms is instances the endpoint answered.**

Precision and recall are computed over deliberately different denominators, and
both counts are stated beside both figures rather than in a footnote:

- **Recall** is averaged over every answered instance. An instance that returned
  something unusable contributes **0**, because the gold tables exist and none of
  them were found. That is a measurement, not an imputation.
- **Precision** is averaged over answered instances that produced a schema.
  Precision over zero generated elements is undefined, and imputing 0 would be
  inventing a measurement rather than recording one.

So a result reads "precision 40% (n=60), recall 24% (n=100)" and never "precision
40%" alone.

**Infrastructure failures are excluded from both** and reported separately. An
endpoint that never answered has told us nothing about the model, and the same
rule already keeps the reflection loop's convergence rate honest.

### Why the answered-instances denominator leads, and not usable-instances

Two figures are available and both are true. "Precision over usable instances"
describes schema quality when the arm works. "Precision over answered instances"
describes the arm as something a developer would actually use.

The second leads, for a reason that has nothing to do with which flatters the
pipeline: **the pipeline arm produced a usable schema for all 100 instances.**
Leading with usable-only figures would compare the pipeline over 100 against the
baseline over some smaller number, and a comparison across different denominators
is invalid regardless of what the numbers say. It is the same error as the two
arms using different aggregation code, which was found and fixed today.

The usable-only figure is reported alongside, because "how good is it when it
works" is a real question. It is simply not the headline.

### The aggregation defect found today

Both runners computed macro averages over instances that produced a schema,
silently excluding the rest from **both** precision and recall. Two things about
it are worth recording rather than quietly fixing:

**The exposure was asymmetric.** On the pipeline arm every instance answered and
produced a schema, so the defect changed nothing. On the baseline arm, where
unusable responses are expected, it would have reported the average of the
instances that happened to work and presented it as a reliability figure.

**The pipeline figures were verified, not assumed unaffected.** Re-aggregating
the committed schemas under the corrected function reproduced 55.2% / 31.0%
exactly, so the published numbers stand on a check rather than on an argument.

The two arms now share one aggregation function. Using different code on either
side of a comparison would invalidate it whatever the numbers showed.

### A property of the parser, for §2.5.1

Recursive descent reports the position at which it could no longer proceed. For
an unrecognised construct **inside** a bracketed list that position is
systematically the enclosing parenthesis, not the offending token, because the
parser stops recognising column definitions and the closing parenthesis becomes
unreachable. Measured:

| construct | verdict | line |
| --- | --- | --- |
| unrecognised construct inside a table body | `UnclosedParenthesis` | the enclosing `(` |
| a second, different one inside a body | `UnclosedParenthesis` | the enclosing `(` |
| unrecognised construct outside any body | `UnexpectedToken` | the offending token |
| unrecognised statement keyword outside | `UnexpectedToken` | the offending token |

This explains with one mechanism both the published grammar collapsing every
unsupported construct into `UnclosedParenthesis` at line 1, and the two MySQL
generated-column cases doing the same under the extended grammar. **It is not a
coverage gap that widening the grammar fixes.** It is a property of recursive
descent over bracketed lists and belongs in §2.5.1 stated as such.

**The consequence, which matters more than the mechanism:** the error-type
distribution for parse failures is a distribution over *parser states*, not over
*causes*. `UnclosedParenthesis: 2` means two unrecognised constructs, not two
unbalanced parentheses. `ScopeViolation` is the exception — it is detected at
statement level before any body is entered, so it does identify its cause. Any
table of Layer 0 error types must say which of its rows describe causes and which
describe the position at which the parser gave up.

### Amendment, same sitting: the answered count is itself a denominator

The rule above excludes instances the endpoint never answered, from both arms.
That is consistent, but it moves the problem up one level: if the baseline arm
accumulates several unanswered calls while the pipeline arm had none, the
headline figures again run over different totals — 100 against 97 — and a reader
comparing them would assume both were 100.

**So the answered count is reported for each arm immediately beside its headline,
not derived and not deferred to a table further down.** A comparison reads:

> pipeline: recall 31.0% (answered 100/100)
> baseline: recall 24.0% (answered 97/100, 3 unanswered)

This is the same disclosure the precision and recall denominators already get.
Any figure whose denominator differs between arms must carry that denominator
wherever the figure appears, because the alternative is a reader silently
assuming they match.

Recorded while the baseline run is still executing and no aggregate exists.

## Week 9 — 2026-08-13 — Scenario A: pipeline schema against the monolithic baseline

**Done:** the baseline arm, 100 instances, 167.1 minutes, scored against the same
gold standard and the same aggregation function as the pipeline arm. Artefacts in
`tests/spider/monolithic-2026-08-13/`.

### Schema correctness, normalised matching, macro

| | pipeline (Agent 1) | monolithic baseline |
| --- | --- | --- |
| answered | **100/100** | **99/100** (1 unanswered) |
| usable schemas | 100 | 99 (0 split failures) |
| tables — precision | 55.2% | **62.8%** |
| tables — recall | **31.0%** | 27.7% |
| columns — precision | **28.9%** | 25.9% |
| columns — recall | **11.4%** | 9.2% |
| foreign keys — precision | 5.7% | **8.6%** |
| foreign keys — recall | **1.9%** | 1.4% |

Exact matching: pipeline tables 36.2% / 19.4%, baseline 33.4% / 12.8%.

**The result is mixed, not a rout.** The pipeline wins five of six measures; the
baseline wins table and foreign-key precision. The shape of the difference is a
precision/recall trade: the baseline proposes fewer tables and a higher
proportion of them are right, while the pipeline proposes more and recovers more
of the gold schema. Neither arm is close to reproducing the relational structure
— foreign-key recall is under 2% on both.

### The Layer 0 comparison is invalid, and the reason is the harness

Layer 0 accepted 98 of 100 baseline schemas against 45 of 100 pipeline schemas.
That is not a property of either model.

| | pipeline | baseline |
| --- | --- | --- |
| emitted output containing non-DDL statements | 63/100 | 49/99 |
| **extracted schema** containing them | 63/100 | **0/99** |

The baseline is instructed to fence its SQL, because splitting the two artefacts
out of one response requires a delimiter. Agent 1 is instructed **not** to fence.
The splitter therefore discards everything outside the fenced block, and the
baseline's non-DDL statements are removed mechanically before Layer 0 sees them.
The 98-against-45 figure measures the splitter.

**The like-for-like measure is the first row: 63/100 against 49/99.** On that,
the baseline emits non-schema statements slightly *less* often, and the gap is a
fraction of what the acceptance figures imply. Chapter IV must report the first
row and must not report the second as a comparison.

There is a genuine finding underneath, and it is about prompt design rather than
model capability: **requiring delimited output makes downstream verification
trivially easier.** A response whose schema is fenced can have everything else
discarded losslessly; a response emitted as one undelimited blob cannot. That
favours the baseline's output format, not the baseline's model, and it is worth
stating because it is actionable for anyone building a verifier.

### Reliability and cost

- **Split failures: 0 of 99.** Every answered response separated into a schema
  and a module. Six carried an extra JavaScript block, invariably a usage example
  mounting the router in an app; the router was selected and the count recorded.
- **`academic` failed three times**, on three separate attempts, with the same
  `fetch failed` from the Ollama endpoint. It is the largest gold schema in the
  subset at 15 tables and one of the three descriptions reduced to the db_id
  alone. Three identical failures on the same instance suggests a length-related
  failure rather than a flake, and it is excluded from both denominators as
  infrastructure.
- **Latency:** 167.1 minutes for 99 generations, mean ~100 s.
- **Tokens:** 18 420 prompt, 71 038 completion, arm total.

### Technical limitations

1. **The per-instance token data was lost.** Re-running to re-aggregate
   overwrote it with zeros: reused instances returned no telemetry, and the guard
   against a partial run clobbering a fuller one does not fire when both have 100
   instances. The arm-level totals survive from the run's console output and are
   recorded in `results.json` with a provenance note saying they are not
   reproducible from that file. The runner now writes telemetry beside each
   response so a resumed run restores it.

2. **Table precision favours an arm that proposes less.** The baseline's higher
   precision is partly a consequence of naming fewer tables; precision rewards
   restraint and recall punishes it. Neither figure should be cited without the
   other.

3. **One arm's schema passed through an extraction step the other's did not.**
   This affects Layer 0 acceptance as described above. It does **not** affect the
   precision and recall figures, which are computed from the schema each arm
   produced by the same reader in both cases.

## Week 9 — 2026-08-13 — Scenario B design, fixed before the run

Scenario A exposed a comparison that measured the harness rather than the model.
Scenario B contains two asymmetries of the same kind, both larger. They are
settled here, before any Scenario B instance exists.

### Asymmetry 1, the important one: repaired against unrepaired

The pipeline runs two bounded reflection loops. The baseline gets one call. A
verdict comparison between "the pipeline's output after up to ten generations"
and "the baseline's first and only attempt" is not a comparison of generation
quality — it is a comparison of a system with repair against a system without it.

**Both are measured and reported separately:**

- **baseline** — one call, one verdict.
- **pipeline, attempt 1** — Agent 1's first schema and Agent 2's first module,
  before any feedback. This is the like-for-like arm and it is what a single-shot
  comparison must cite.
- **pipeline, final** — after both loops converge or exhaust.

The difference between the second and third rows is the value the loop adds, and
it is a separate claim from the difference between the first and second. Chapter
IV must not collapse them. Metric 3, mean iterations to convergence, applies to
the pipeline only; the asymmetry is stated rather than the baseline being
recorded as zero.

### Asymmetry 2: extraction, the same defect that invalidated Layer 0 in Scenario A

The baseline is told to fence its JavaScript, so the splitter hands Layer 1 a
clean module. Agent 2 is told **not** to fence, and its output reaches Layer 1
through `stripFences` alone. Layer 1 acceptance across arms would therefore
measure the delimiter, exactly as Layer 0 acceptance did.

**Decision, in three parts.**

1. **Agent 2's prompt is not changed.** Telling it to fence would make the arms
   symmetric, and it would also make v5 a different artefact from the one measured
   throughout Weeks 8 and 9. Every prompt-iteration result, the constraint
   saturation findings, and both paired reflection runs describe v5 as it stands.
   Buying symmetry by invalidating the project's own prior evidence is a bad
   trade.

2. **Layer 1 and Layer 2 acceptance are reported per arm, with the extraction
   path stated, and carry no comparative claim.** Same treatment as Layer 0 in
   Scenario A.

3. **A symmetric measure is reported alongside.** `splitArtefacts` is applied to
   the raw output of **both** arms, and the proportion of responses containing
   content that had to be removed before the module could be parsed is recorded
   for each. One function, both arms, no delimiter advantage. This is the
   Scenario B equivalent of the 63/100 against 49/99 figure that replaced the
   invalid Layer 0 comparison.

### What Scenario B therefore reports

| measure | baseline | pipeline attempt 1 | pipeline final |
| --- | --- | --- | --- |
| schema precision and recall | yes | yes | yes |
| non-code content requiring extraction | yes | yes | — |
| Layer 0/1/2 verdicts | per arm, no cross-claim | per arm | per arm |
| iterations to convergence | not applicable | — | yes |
| latency | yes | yes | yes |
| tokens | yes | yes | yes |

Two fixtures only, blog and orders, so every figure here is n=2 and is a
description of two runs rather than an estimate of anything. Scenario A is where
the sample size lives.

### Why this is recorded now

The Layer 0 comparison in Scenario A looked decisive and would have been easier
to publish than to interrogate. It was traced to the splitter only because the
number was implausible against the previous day's evidence. The same trap is
visible in advance here, so the alternative is chosen before the numbers exist
rather than after they turn out to be flattering.

### Correction to the Scenario B design, before it runs

The table above lists "schema precision and recall" as measured in Scenario B.
**It cannot be.** Precision and recall are computed against a gold standard, and
Scenario B uses two feature descriptions with no gold schema attached — Spider
supplies gold, these fixtures do not. Listing it was an error, made by copying
the row set from Scenario A.

Scenario B measures verdicts, iterations to convergence, latency, token
consumption, and the symmetric extraction measure. **Schema correctness is
Scenario A's metric and only Scenario A's.** Corrected here rather than
discovered at write-up.

The descriptions are the two committed in
`tests/fixtures/runs/2026-08-11-layer0-live/probe.json` as `c1-blog` and
`c2-orders`:

- *"A blog with users, posts and tags. Posts belong to a user and can have many
  tags."*
- *"An online shop with customers, orders and the line items on each order."*

They are used because they are already in version control with their outputs, not
because they produced the Week 8 fixtures — the descriptions behind those were
never recorded, which is itself a reproducibility gap worth naming.

**One consequence worth stating in advance.** On `c1-blog` Agent 1 emitted
`CREATE TYPE tag_name AS VARCHAR(255)`, which fails Layer 0. Scenario B will
therefore exercise the Agent 1 repair loop against the live model for the first
time, and answer the question left open on 2026-08-11: whether Agent 1 can act on
a Layer 0 critique. That was the original purpose of the paired probe and it has
been outstanding since.

Because generation is deterministic, attempt 1 inside the pipeline's transcripts
is byte-identical to a standalone single-shot run. The like-for-like arm is
therefore read out of the transcript rather than generated separately, which
removes one full generation per fixture and is exact rather than approximate.
