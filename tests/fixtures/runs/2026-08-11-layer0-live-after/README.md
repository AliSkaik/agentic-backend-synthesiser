# 2026-08-11 — Layer 0 after the grammar extension

The "after" half of a paired measurement. Same eight descriptions, same model,
same decoding settings, same machine as
[`../2026-08-11-layer0-live/`](../2026-08-11-layer0-live/) — one variable moved:
the parser was extended to cover the constructs that run showed it rejecting.

Because the inputs are identical and only the parser changed, the rate movement
below is causal rather than a comparison of two unrelated samples.

## Result

| id | kind | extended before | extended after |
| --- | --- | --- | --- |
| `c1-blog`      | control | fail `UnexpectedToken` L1 | **fail** `UnexpectedToken` L1 |
| `c2-orders`    | control | pass | pass |
| `c3-users`     | control | pass | pass |
| `p1-money`     | probe   | fail `UnexpectedToken` L9 | **pass**, 4 tables |
| `p2-timezone`  | probe   | fail `UnexpectedToken` L1 | **pass**, 2 tables |
| `p3-arrays`    | probe   | fail `UnexpectedToken` L5 | **pass**, 1 table |
| `p4-floats`    | probe   | pass | pass |
| `p5-uuid-json` | probe   | pass | pass |

| | before | after |
| --- | --- | --- |
| extended grammar accepted | 4 / 8 | **7 / 8** |
| false failures | **3 / 8 (37.5%)** | **0 / 8** |
| true positives | 1 | 1 |
| published grammar accepted | 0 / 8 | 0 / 8 |

**The one rejection is the one that should be rejected.** `c1-blog` still fails,
because `CREATE TYPE tag_name AS VARCHAR(255)` is still not valid PostgreSQL.
The extension added a composite `CREATE TYPE ... AS (...)` production and a
`CREATE DOMAIN` production — the construct Agent 1 was reaching for — while
keeping the accepted forms after `AS` as an explicit whitelist of ENUM, RANGE
and composite. A fallthrough there would have been one line shorter and would
have destroyed the only true positive this project has.

The critique it produces also improved, which is the only textual difference
between the two runs:

```
- Expected ENUM after AS at line 1, column 24:
+ Expected ENUM, RANGE, or ( after AS, found "VARCHAR". A type over an existing
+ base type is CREATE DOMAIN, not CREATE TYPE at line 1, column 24:
```

The first version names what the parser wanted. The second names what the model
did wrong and what the correct construct is. Only the second is a critique Agent
1 could act on, and whether it can is still untested.

**The published grammar is unmoved at 0/8**, which was a requirement rather than
an outcome: extending the accepted set must not shift the comparative figure, or
the two acceptance rates stop being comparable.

## Determinism, on eight fresh descriptions

Every one of the eight generated schemas is **byte-identical** between the two
runs, in separate processes minutes apart:

```
identical  c1-blog.sql      identical  p1-money.sql
identical  c2-orders.sql    identical  p2-timezone.sql
identical  c3-users.sql     identical  p3-arrays.sql
                            identical  p4-floats.sql
                            identical  p5-uuid-json.sql
```

Prior determinism evidence rested on two fixtures. This extends it to eight
descriptions across eight domains, and it is the evidence §2.8's single-run
reporting of output metrics now depends on.

Latency was **not** identical — `c1-blog` ran 47 748 ms then 38 687 ms, both
carrying the cold start, and the rest moved by under 2%. Identical bytes with
different wall time is the same observation Week 7 recorded in reverse: timing
and decoding are independent, and neither proves the other.

## Correction to the latency estimate

The working estimate for 100 Spider instances was 8–10 minutes, derived from
the 4 724 ms warm median in Week 7. These eight descriptions average **17.3 s**
including a cold start, or **14.2 s** excluding it — the Week 7 median came from
a one-table `users` prompt, and realistic multi-table descriptions cost three
times that.

**100 instances is roughly 25–30 minutes of generation**, before any repair
loops. My earlier reading of "over half an hour" was taken from the first run's
~20 s mean and is slightly high; this is the corrected figure.

## Files

Same layout as the before run: `probe.json`, `generated/<id>.sql`, and a
`layer0-feedback.txt` for the single remaining failure.
