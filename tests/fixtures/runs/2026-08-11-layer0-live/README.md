# 2026-08-11 — Layer 0 against live Agent 1 output

The first time Layer 0 has seen anything the model produced in the moment
rather than a fixture recorded in Week 8. **This is the "before" measurement:
it describes the parser as committed in `3602c67`, and it is committed
unchanged before that parser is extended.**

Single generation per description, no repair loop. `qwen2.5-coder:7b`,
`temperature: 0`, `seed: 42`, same machine as every other run in this logbook.

## Design

Eight descriptions: three **controls** in the domains the Week 8 fixtures came
from, and five **probes** written to invite PostgreSQL types the extended
grammar does not cover.

The probes are deliberately not written to produce *bad* SQL. They are written
to produce *good* SQL this parser may reject, because limitation 3 of the Layer
0 logbook entry states that the parser errs toward false failures and that the
rate is unknown. This run measures that rate.

## Result

| id | kind | latency | chars | extended | published |
| --- | --- | --- | --- | --- | --- |
| `c1-blog`      | control | 47 748 ms | 653 | **fail** `UnexpectedToken` L1 | fail L1 |
| `c2-orders`    | control | 28 923 ms | 837 | pass, 3 tables | fail L1 |
| `c3-users`     | control |  5 431 ms | 141 | pass, 1 table  | fail L1 |
| `p1-money`     | probe   | 19 295 ms | 578 | **fail** `UnexpectedToken` L9 | fail L9 |
| `p2-timezone`  | probe   | 11 300 ms | 326 | **fail** `UnexpectedToken` L1 | fail L1 |
| `p3-arrays`    | probe   | 10 304 ms | 299 | **fail** `UnexpectedToken` L5 | fail L5 |
| `p4-floats`    | probe   | 18 575 ms | 585 | pass, 3 tables | fail L1 |
| `p5-uuid-json` | probe   |  5 547 ms | 139 | pass, 1 table  | fail L1 |

**Extended grammar: 4 of 8 accepted. Published grammar: 0 of 8.**

The published grammar's 0/2 against the Week 8 fixtures holds at 0/8 against
fresh output.

## One true positive, three false failures

`c1-blog` is a **real defect the gate caught**, and it is the most important
single result in this run:

```sql
CREATE TYPE tag_name AS VARCHAR(255);
```

PostgreSQL has no `CREATE TYPE <name> AS <basetype>` form. The variants are
composite (`AS (...)`), `AS ENUM`, `AS RANGE`, and base-type declarations; a
type alias over `VARCHAR(255)` is `CREATE DOMAIN`. This statement does not
execute.

It matters that this appeared on a **control** — a plain blog description, the
same domain as an existing fixture, with no adversarial prompting — and that it
is a defect class **no other layer can catch**. Layer 2 reads columns out of
`CREATE TABLE` blocks and never inspects a type declaration. Layer 1 never sees
the DDL at all. Without Layer 0 this schema reaches Agent 2, which writes routes
against a table whose column type does not exist, and the first request fails at
runtime.

The other three rejections are **false failures** — valid PostgreSQL the parser
does not cover:

| id | construct | why rejected |
| --- | --- | --- |
| `p1-money`    | `CREATE TYPE currency AS (amount NUMERIC(19,4), currency_code CHAR(3))` and `0::NUMERIC` casts | composite types unsupported; `::` not tokenised |
| `p2-timezone` | composite type, and `TIMESTAMP WITH TIME ZONE` | composite unsupported; multi-word type names unsupported |
| `p3-arrays`   | `TEXT[]`, and `CREATE INDEX ... USING GIN` | array suffix not tokenised; no production for CREATE INDEX |

In `p1-money` the reported error is the `::` cast at line 9, not the composite
type at line 1, because tokenising fails before parsing begins. The reported
cause is therefore the *second* unsupported construct in the file, not the
first — the same misattribution problem recorded for the published grammar,
arriving by a different route.

**False-failure rate on this sample: 3 of 8 (37.5%).**

## Why this stopped WP2

WP2 records the Layer 0 verdict per instance across 100 Spider schemas and, if
Layer 0 gates the run, sends failures into an Agent 1 repair loop. At this rate
roughly a third of instances would be re-prompted to correct SQL that was
already correct, at ~20 s per attempt, and the resulting mean-iterations-to-
convergence figure would measure this parser's coverage gaps rather than the
model's ability to repair. That number is evidence for the research question in
Chapter IV, so the error is not imprecision — it is a measurement of the wrong
thing.

## Latency

5 431 ms to 47 748 ms per generation; `c1-blog` ran first and carries the cold
start. The spread is far wider than the 4 724 ms warm median recorded in Week 7,
and WP2's "8–10 minutes for 100 instances" estimate is built on that median. At
a ~20 s mean this run implies **over half an hour** for the Spider generation
pass alone, before any repair loops.

## Files

| file | what it is |
| --- | --- |
| `probe.json` | every record: description, latency, char count, and both grammar verdicts |
| `generated/<id>.sql` | the DDL Agent 1 returned, after fence-stripping, byte-for-byte |
| `generated/<id>.layer0-feedback.txt` | the exact critique Layer 0 produced, for the four that failed |

```
c8242a37a7f9d2a90edf9a113911c4e321c4b241ac87c0b28d3e69cb9f6329ec  c1-blog.sql
d4c113667d068f130ce10b258e229024e0f09e402e9a581477e8eca9e86f391d  c2-orders.sql
d19e2d689cedd48257bb8cd70b46ab898d1a5d1085c556ac802fcfa2207f150d  c3-users.sql
1d6b010b36caebae57b08b7f612da8deb447af753bf3c55ce7f063adee09d976  p1-money.sql
be88edc985bab053478081d4d80fe00cad4d119182fb23653146ab3ec49ba4a4  p2-timezone.sql
81cb2001cc5d5806fc0dd46402d07afa7d112c152e06c09da2263e4fcc11956f  p3-arrays.sql
90be4a2d5cb22a7c69a9bead13d542bf15e2fcc544f068cb733765cfac345567  p4-floats.sql
08d325b3d753b7b93de977442ac5f56cdc0eff83b42863c5fd051cb06e1c027b  p5-uuid-json.sql
```

## What happens next

The parser is extended to cover composite types, array suffixes, multi-word type
names, casts, and index/domain statements. The same eight descriptions are then
re-run unchanged — same inputs, one variable moved — so the rate movement can be
stated causally rather than as two unrelated samples.
