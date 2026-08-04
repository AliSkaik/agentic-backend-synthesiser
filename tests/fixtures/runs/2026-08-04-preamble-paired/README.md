# Paired run — isolating the feedback preamble, 2026-08-04

Answers the question left open by limitation 2 of the "N=5 reflection loop"
logbook entry: was the repair caused by Agent 3's critique, or by the sentence
framing it?

## Design

Two arms, identical in every respect except one line of the user prompt.

| | arm A | arm B |
| --- | --- | --- |
| user prompt | DDL + preamble + critique | DDL + critique |
| preamble | "Your previous attempt at this task was rejected by an automated check." | omitted |

Held constant: seed candidate (`v4-orders`), DDL (`orders-schema.sql`), system
prompt, `temperature: 0`, `seed: 42`, `maxAttempts: 5`, model
`qwen2.5-coder:7b`. The critique was the same string in both arms, since both
arms failed attempt 1 identically.

## Result

| | seed | arm A | arm B |
| --- | --- | --- | --- |
| routes | 13 | **10** | **13** |
| chars | 6 349 | 4 242 | 5 558 |
| `updated_at` refs | 2 | 0 | 0 |
| latency | — | 142 656 ms | 166 687 ms |
| verdict | fail Layer 2 | verified | verified |

**Both arms repaired the named defect. Only arm A deleted routes.** Arm B
removed the invented `updated_at` while keeping all three
`order_line_items` routes that arm A dropped.

## Why this is a controlled comparison and not two samples

Arm A reproduced the module recorded on 2026-08-04 **byte-for-byte**
(`sha256 799ad20a…`, identical to
`../2026-08-04-v4-orders/attempt-2.js.txt`), in a separate process on a
separate invocation.

That matters more than it looks. It establishes that `temperature: 0,
seed: 42` is deterministic across processes for Agent 2 — previously assumed
from the Week 7 Agent 1 result and a within-session Week 8 check, never tested
this way. Because generation is deterministic, the difference between arm A and
arm B **cannot be sampling noise**: the only varying input was the preamble, so
within this case the preamble is the cause of the route deletion.

What that does *not* establish is generality. One schema, one defect class, one
critique. It is a clean result on a single input, not a measured effect.

## Files

| file | sha256 | what |
| --- | --- | --- |
| `arm-A-with-preamble.js.txt` | `799ad20a4fa4…` | repair with the framing sentence — 10 routes |
| `arm-B-critique-only.js.txt` | `17ccab82326e…` | repair from the critique alone — 13 routes |
| `paired.json` | — | both transcripts, hashes, and the determinism check, as written by the run |

Both modules pass `verify()` — re-checked after copying here, both
`verified: true`. Arm A is byte-identical to the previously committed run
artefact and is duplicated here deliberately, because this directory has to
stand on its own as a comparison.

## Consequence for the earlier finding

The reflection-loop logbook entry attributes the 13 → 10 route loss to
constraint saturation — the model taking the cheapest path to satisfying a
soundness gate. That mechanism still explains why the **gate cannot catch** the
loss: deleting a route does remove the offending column reference, and the
shrunken module genuinely is sound.

It does not explain what **triggered** the loss. The trigger was the preamble,
which was an unforced addition to the prompt, not a property of feedback-driven
repair. See the correcting logbook entry dated 2026-08-04.
