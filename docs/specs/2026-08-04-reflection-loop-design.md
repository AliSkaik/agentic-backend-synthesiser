# Design: N=5 self-healing reflection loop

Status: approved 2026-08-04. Not yet implemented.

## Purpose

Close the pipeline. Agent 1 produces DDL, Agent 2 produces routes, Agent 3
judges them. Nothing currently acts on that judgement — a failing verdict is
printed and discarded. This component takes a failure, converts it into a
correction prompt, and re-runs Agent 2, up to a fixed attempt cap.

The claim under test is not that the loop works. It is whether a 7b model,
given a deterministic and specific description of its own defect, produces a
module that passes a check it previously failed. "It does not converge" is a
result, and the design records enough per attempt to say so with evidence.

## Scope

In scope: Layers 1 and 2 as the gate; re-prompting; attempt cap; the
emit/withhold decision; a per-attempt transcript.

Out of scope, deliberately: executing the generated routes and observing HTTP
status codes. That requires Express, `pg`, a live schema and request synthesis,
none of which exist in this repository. It is a runtime verification layer
belonging to the Week 9 evaluation harness, and it plugs in behind the
interface defined here without changing the loop. This is a narrowing of the
deliverable as originally committed ("N=5 self-healing reflection loop with
HTTP 500 rollback") and is to be reported as such at the Mid-Point Review, not
absorbed quietly.

## Why re-prompting can work at all

Agent 2 runs at `temperature: 0, seed: 42`. Two runs on an unchanged input are
byte-identical — established for Agent 1 in Week 7 (limitation 3) and confirmed
for Agent 2 in the Week 8 wrapper verification.

The loop therefore cannot retry. Re-issuing the same request returns the same
defective module five times. The only reason attempt *k+1* can differ from
attempt *k* is that the prompt changed, and the only thing changing it is the
`feedback` string from Agent 3.

This makes `feedback` load-bearing rather than cosmetic, and retrospectively
justifies a decision made in Layer 1: rendering the offending source line with
a caret beneath it inside the verifier, rather than returning a bare line
number for a driver to reassemble later. Agent 2 receives a plain string and
never sees line numbers, so `line: 173` alone is not correction input.

## Architecture

Two new modules. They answer different questions and change for different
reasons, so they are separated.

### `src/verify.js` — one module, one verdict

```
verify(code, ddl) -> {
  verified: boolean,
  layer:    number | null,   // the layer that failed; null when verified
  error:    object | null,   // the failing layer's structured error
  feedback: string | null,   // the failing layer's re-prompt text
  ast:      object | null    // retained on success for later layers
}
```

Runs Layer 1. On failure, returns immediately — Layer 2 consumes the AST that
Layer 1 produces, so a parse failure makes Layer 2 unrunnable, not merely
unnecessary. On success, passes the AST and the DDL to Layer 2 and returns its
verdict.

**This is the only place in the codebase permitted to set `verified`.** The
header of `src/agents/integrityVerifier.js` reserves that word for "the
orchestrator that runs all of them", and until this module exists the word has
no owner — a rule stated in a comment and enforced nowhere. This file is the
enforcement.

Adding a runtime layer later means editing this file and nothing else. The loop
never learns what a layer checks.

### `src/reflect.js` — the loop

```
reflect(ddl, {
  maxAttempts:   5,
  seedCandidate: null,       // string: use as attempt 1 instead of generating
  timeoutMs:     600_000,
  generate:      designRoutes // injectable for testing
}) -> {
  code:     string | null,   // null when exhausted
  verified: boolean,
  attempts: Attempt[]
}
```

Owns the attempt cap, the re-prompt, the transcript, and the emit decision.
Its entire view of Agent 3 is one boolean and one string.

### Data flow

```
attempt 1 -> Agent 2: system + DDL                  -> verify() -> verified? emit, stop
             (or seedCandidate, no generation)                     else carry feedback
attempt 2 -> Agent 2: system + DDL + feedback(1)     -> verify() -> ...
attempt 3 -> Agent 2: system + DDL + feedback(2)     -> verify() -> ...
attempt 4 -> Agent 2: system + DDL + feedback(3)     -> verify() -> ...
attempt 5 -> Agent 2: system + DDL + feedback(4)     -> verify() -> exhausted
                                                                    emit nothing
```

## Decisions

### N=5 means five generations in total

One initial generation plus up to four repairs — not one plus five. Stated
because the alternative reading is equally natural and the figure appears in
the results.

Worst case is five Agent 2 calls at 179–244 s, so **roughly 15–20 minutes per
schema per run**, and about 40 minutes across both fixtures. This cost is why
`seedCandidate` exists and why the loop's own logic is tested against a stub.

### Feedback enters the user prompt, never the system prompt

`designRoutes` gains an optional second argument: `designRoutes(ddl, {
feedback })`, appending the feedback beneath the DDL when present. The system
prompt is untouched.

The system prompt is the artefact under study across v1–v5. Mutating it inside
the loop would mean the prompt-iteration experiment and the reflection
experiment are no longer measuring separate things, and no result from either
could be attributed to one cause.

### Only the most recent feedback is forwarded

Each attempt is a fresh stateless call: system prompt, DDL, one feedback
string. Neither prior attempts nor prior critiques accumulate.

This follows directly from Week 8 limitation 1 (constraint saturation): each
rule competes for the same limited instruction-following capacity, and adding
one reliably costs another. Five accumulated critiques plus ~7 kB of prior
output would spend that capacity on history rather than on the correction. It
also keeps every attempt the same size, so per-attempt latency stays
comparable across the run instead of drifting with prompt length.

Accepted cost: the model may repair the named defect while re-breaking
something an earlier attempt had right. The transcript will show this if it
happens, since every attempt's verdict is retained.

### On exhaustion, emit nothing

No module is returned when all attempts fail. The alternative — returning the
best or the first candidate, tagged unverified — was rejected.

`verified` has meant one thing since Layer 1: every layer passed. A function
that returns a module alongside `verified: false` invites a caller to use it
anyway, which is the false-pass failure mode this entire agent was built in
response to (Week 8 limitation 2). Renaming `verified` to `passed` in Layer 1
made that mistake structurally unavailable rather than merely discouraged;
withholding the artefact here is the same move at the pipeline level.

The withheld module is not the measurement. The transcript is: convergence
rate at N=5, the attempt at which convergence occurred, and the failure
distribution across attempts are all recoverable whether or not a module is
emitted.

### An unreachable model is not a verification failure

An Ollama error, a non-200 response, or a timeout ends the loop immediately
and is recorded as `infrastructure` failure, distinct from `unverified`.
Conflating "the model produced bad code" with "the model never answered"
would corrupt the convergence rate — the headline figure of the experiment.

### Explicit timeout on the Ollama call

`src/config/ollama.js` currently calls `fetch` with no timeout and therefore
inherits undici's default (~300 s in the Node 18/20 line). With `stream:
false`, Ollama sends no response headers until generation completes, so the
entire 179–244 s generation sits inside that window. The worst logged
generation is 244 s against a ~300 s ceiling.

A marginally larger schema would abort the run with `UND_ERR_HEADERS_TIMEOUT`,
which presents as a network fault rather than as a limit that was chosen. N=5
multiplies the exposure fivefold. Week 8 limitation 5 predicted this
requirement; the loop is where it stops being optional.

Set via `AbortSignal.timeout(timeoutMs)`, default 600 s — well clear of the
observed range, so a breach indicates something genuinely wrong rather than
merely slow.

Threading it requires a change at each hop, since no layer currently forwards
options: `reflect(ddl, { timeoutMs })` → `designRoutes(ddl, { feedback,
timeoutMs })` → `generate(prompt, { system, options, timeoutMs })` → `fetch(...,
{ signal })`. `generate` keeps 600 s as its own default so a caller that omits
it is still protected.

### `seedCandidate` allows attempt 1 to be a recorded fixture

Two recorded failures already exist and cover both layers:

| fixture      | fails   | exercises repair driven by |
| ------------ | ------- | -------------------------- |
| `v5-orders`  | Layer 1 | syntax feedback            |
| `v4-orders`  | Layer 2 | schema feedback            |

Seeding from these removes ~200 s from every development iteration, and makes
the Chapter IV run reproducible without depending on Agent 2 reproducing its
Week 8 output under a future model or Ollama version — which Week 7
limitation 3 explicitly declines to guarantee.

## Transcript

One record per attempt, written as JSON so the results table is generated from
the run rather than transcribed by hand.

```
Attempt = {
  attempt:        number,
  source:         "generated" | "seed",
  latencyMs:      number | null,
  outputChars:    number | null,
  verified:       boolean,
  failedLayer:    number | null,
  errorType:      string | null,   // SyntaxError | EmptyOutput | UnknownColumn | NoSchema
  violationCount: number,
  feedbackSent:   boolean          // whether this attempt's feedback fed the next
}
```

The generated module for each attempt is written to disk alongside the
transcript. A defect described in the logbook must be inspectable later, and
attempts that are discarded by the loop are exactly the ones worth reading.

## Testing

`verify()` inherits the four fixture cases currently in `tests/layer2.test.js`,
which move across unchanged. They already assert layer attribution —
`v5-orders` must fail at Layer 1 and never reach Layer 2 — which is the
short-circuit rule this module now owns.

`reflect()` is tested against a stubbed `generate`, returning scripted outputs
in sequence. This proves the loop's own logic — attempt cap, early exit on
first success, withholding on exhaustion, transcript shape, infrastructure
failure handling — in milliseconds and with no dependence on Ollama.

Cases: converges on attempt 1; converges on attempt 3; exhausts all 5 and
emits nothing; generator throws on attempt 2 and the run is marked
infrastructure; `seedCandidate` supplied and no generation occurs for
attempt 1.

The live N=5 run against Ollama is then an **experiment**, not a test. It has
no expected result, it takes 15–20 minutes, and its output is Chapter IV data.
Keeping it out of `npm test` keeps the test suite deterministic and fast.

## Known limitations to record on implementation

1. **Convergence is unmeasured and may be zero.** No evidence yet exists that
   this model repairs from feedback. A 7b model that drops conditional
   instructions may return the same defect five times, or fix the named column
   and break another. The design assumes nothing about the outcome.
2. **Only two defect classes can be exercised**, because the gate is only two
   layers deep. The `v5-blog` `req.body`/`req.params` defect passes both layers
   and so cannot enter the loop at all — the loop can only repair what Agent 3
   can see, and the coverage of the loop is bounded by the coverage of the
   verifier, not by N.
3. **Sample size is two fixtures.** Week 8 limitation 3 already established
   that correctness on one schema did not generalise to a second. A convergence
   rate computed over two schemas is an observation, not a measurement.
