# Paired run — `v5-orders`, Layer 1 syntax repair, 2026-08-04

The first time the **Layer 1 syntax-repair path has run against the live
model**. Until this run it existed only against a stub. Same paired design as
`../2026-08-04-preamble-paired/`: two arms differing only in whether the framing
sentence precedes Agent 3's critique.

Held constant: seed (`v5-orders.js.txt`), DDL (`orders-schema.sql`), system
prompt, `temperature: 0`, `seed: 42`, `maxAttempts: 5`, `qwen2.5-coder:7b`.

## The critique both arms received

```
Layer 1 (syntax): the module you returned does not parse as JavaScript.
Unexpected token at line 173, column 34:

  173 |     const params = ["$" + (i + 1) for (i in cols)].join(", ");
      |                                   ^

Return the complete module again, corrected so that it parses as an ES module.
```

A harder target than the Layer 2 case. The schema critique named a column to
delete and listed the legal alternatives; this one points at a construct that
must be **replaced** with something the model has to invent.

## Result

| | seed | arm A (preamble) | arm B (critique only) |
| --- | --- | --- | --- |
| generations to converge | — | **1** | **1** |
| latency | — | 248 800 ms | 227 444 ms |
| chars | 5 858 | 7 210 | 7 219 |
| routes | 13 | 15 | 15 |
| verdict | fail Layer 1 (`SyntaxError`) | verified | verified |

**Syntax feedback repairs.** Both arms fixed the array comprehension on the
first repair and passed both layers. This is the first live evidence that the
caret-excerpt feedback built into Layer 1 functions as correction input.

**Both arms also corrected a misclassification.** `order_line_items` has a
`SERIAL PRIMARY KEY`, so under Agent 2's own prompt it is a resource, not a join
table. The seed nested it under `/orders` (3 routes); both arms promoted it to
five top-level routes, giving 5 × 3 tables = 15. Nothing asked for this, and it
is what the prompt actually specifies.

## What the gate did not see

Both arms regressed against the seed on an explicit system-prompt rule.

Rule 1 of Agent 2's system prompt: *"PUT handlers are always written with a
fixed SQL string… never build a PUT's SET list with .map or .join."*

| | seed | arm A | arm B |
| --- | --- | --- | --- |
| `setClause` built with `.map().join()` | 0 | 6 | 6 |
| hardcoded `status = '…'` writes in PUT | 0 | 0 | **2** |

The seed obeyed the rule exactly — a fixed string with numbered parameters.
Both repairs replaced it with a dynamically assembled SET clause. Arm B went
further and appended a literal assignment:

```js
`UPDATE customers SET ${setClause}, status = 'active'  WHERE customer_id = …`
`UPDATE orders    SET ${setClause}, status = 'pending' WHERE order_id    = …`
```

Every `PUT /customers/:id` silently resets `status` to `'active'`, and every
`PUT /orders/:id` resets it to `'pending'`, regardless of the request. That is
data corruption on a real column, and **both layers pass it**: it parses, and
`status` exists in the schema.

Both modules were returned as `verified: true`.

## Consequence

Collateral damage from a repair is **not** specific to the preamble. The route
deletion in the v4-orders pair appeared only in the preamble arm; the rule-1
violation here appears in **both** arms. The general finding is that a repair
regenerates the whole module and can lose constraints the previous attempt
satisfied, and a two-layer soundness gate cannot see it.

## Files

| file | sha256 |
| --- | --- |
| `arm-A-with-preamble.gen-1.js.txt` | `9d7b348baecf…` |
| `arm-B-critique-only.gen-1.js.txt` | `ed1e531d3f13…` |
| `seed-feedback.txt` | `9d4097fb9e46…` |
| `paired.json` | `3818ca498886…` |

Seed is `tests/fixtures/v5-orders.js.txt`, unmodified. Both arms converged in
one generation, so only one module exists per arm.
