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
  declares it as `req.params`, so the insert always binds NULL and violates the
  foreign key. This file parses cleanly.

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
   - _Mitigation:_ Layer 1 of Agent 3 must parse via `.mjs` or
     `node --input-type=module --check`, never `node --check` on a `.js` path.
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
