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
junction) so only the prompt varied. All four produce valid, parseable ES
modules. Working baseline: **v4**, with the correctness caveat in limitation 2.

| criterion              | v1   | v2   | v3      | v4   |
| ---------------------- | ---- | ---- | ------- | ---- |
| valid / parses         | ✅   | ✅   | ✅      | ✅   |
| 404 via `rowCount`     | ❌   | ✅   | ✅      | ✅   |
| junction nested        | ✅\* | ✅   | ✅      | ✅   |
| DEFAULT-col INSERT     | ❌   | ❌   | ✅      | ✅   |
| `updated_at` on UPDATE | ❌   | ❌   | ⚠ broke | ❌   |
| runtime-correct        | ✅   | ✅   | ❌      | ✅†  |
| latency (s)            | 181  | 205  | 244     | 241  |
| output (chars)         | 5945 | 6423 | 7581    | 7195 |

\* v1 nested the junction table unprompted, before the rule existed.
† on the blog fixture only see limitation 2.

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
   - _Mitigation:_ accepted v4, did not over-fit the prompt further.
   - _Residual risk:_ `updated_at` is not guaranteed, so prompt tuning alone is
     insufficient. Motivates deterministic verification in Agent 3.

2. **Correctness is schema-specific, and structural validation does not detect
   it** the two strongest false-pass cases in this iteration both survived
   automated checking.
   - _Cause:_ v3 satisfied all nine structural checks (parses, no fences,
     correct imports, parameterised queries, no invented body columns) while
     being unrunnable: it emitted `CURRENT_TIMESTAMP` as a bare JavaScript
     identifier (`ReferenceError` at runtime) and shifted every `$n` parameter
     one position out of alignment. `node --check` accepted it because both
     faults are syntactically valid JavaScript. v4 then passed the same checks
     _and_ ran correctly on the blog fixture, but on the orders schema its PUT
     handlers compute the id placeholder as `$${cols.length * 2}` binding
     three parameters while referencing `$4`.
   - _Mitigation:_ none at the prompt layer. Recorded as a measurement problem.
   - _Residual risk:_ **an evaluation harness that scores Agent 2 on parse
     success and structural checks will score broken backends as passes.**
     Scoring must execute the generated routes against a live schema, and must
     use more than one fixture a single fixture demonstrated correctness that
     did not generalise to the second schema tested.

3. **Column hallucination under instruction pressure** v4 emits UPDATEs
   referencing an `updated_at` column on schemas that do not declare one.
   - _Cause:_ the prompt instructs the model to append
     `updated_at = CURRENT_TIMESTAMP` whenever the table declares that column.
     The conditional half is dropped (see limitation 1) while the imperative
     half is retained, so the instruction becomes unconditional and the model
     invents the column. On the orders schema `updated_at` occurs zero times in
     the DDL yet appears in both PUT handlers; Postgres would reject these with
     `column "updated_at" of relation "customers" does not exist`. Instructing
     _harder_ made the output worse, not better.
   - _Mitigation:_ pending. The intended fix is to delete the `updated_at`
     section from Agent 2's prompt and have Agent 1 emit a Postgres trigger
     instead, which is where a modify-timestamp belongs regardless.
   - _Residual risk:_ until then, every PUT handler is suspect on any schema
     without an `updated_at` column.

4. **Latency** Agent 2 ranges 181241 s per generation, against Agent 1's
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
