# Live reflection-loop run — 2026-08-04, seeded from `v4-orders`

The evidence behind the run table and the 13 → 10 route finding in the
"N=5 reflection loop" entry of `docs/logbook-notes.md`. That entry is committed
and public; without these files its central claim is unreproducible.

This is a **recorded experiment, not a test.** Nothing here runs under
`npm test`. The loop's own logic is tested against a stub in
`tests/reflect.test.js`, deterministically and in milliseconds. These files are
the one live run, kept because a defect described in the logbook has to be
inspectable later.

## Conditions

| | |
| --- | --- |
| date | 2026-08-04 |
| model | `qwen2.5-coder:7b`, Q4_K_M, 7.6B |
| sampling | `temperature: 0`, `seed: 42` |
| Node | v20.19.6 |
| DDL | `tests/fixtures/orders-schema.sql` |
| seed candidate | `tests/fixtures/v4-orders.js.txt` |
| `maxAttempts` | 5 |
| result | converged on attempt 2; 3 of 5 attempts unspent |
| wall clock | 149 627 ms |

Nothing was tuned, and the run was not repeated after the finding below. A
second run issued after seeing a result is the beginning of tuning.

## Files

| file | what it is |
| --- | --- |
| `attempt-2.prompt-feedback.txt` | the exact `feedback` string Layer 2 produced and the loop forwarded into attempt 2, byte-for-byte |
| `attempt-2.js.txt` | Agent 2's repaired module — the one the loop emitted as `verified` |
| `transcript.json` | the loop's own output, exactly as written by the run |

Stored as `.js.txt` so nothing tries to import them, matching the convention of
the fixtures directory above.

**Attempt 1 is not duplicated here.** It is `tests/fixtures/v4-orders.js.txt`
verbatim — the seed was read from that file and passed through unmodified. A
copy would be a second thing to keep in sync with the file it is supposed to
equal. Identity is checkable by hash:

```
6d7ce269610207863ac457196ed8e79bae09ff7581dbe5dcc6d9584c1b84fcdc  tests/fixtures/v4-orders.js.txt   (= attempt 1)
818d4c2b3135b9b62198af36f84143058caae1f26e225cbb408d24f39ed35096  tests/fixtures/orders-schema.sql
799ad20a4fa4a86556a20aa4546cf020597ac709ece9940f101bd2656ba58222  attempt-2.js.txt
52210557aae683d12aceb4f823e45a2ff4dd721acfd8abefc5bbfc8aba861a10  attempt-2.prompt-feedback.txt
299922a45dd153ce63e48cf767d1141a34aa6f8d0ab5d220d7a9df3c94a398bc  transcript.json
```

## What the run shows

| attempt | source | latency | chars | routes | verdict |
| --- | --- | --- | --- | --- | --- |
| 1 | seed | — | 6 349 | 13 | fail Layer 2, 2 × `UnknownColumn` |
| 2 | generated | 149 592 ms | 4 242 | 10 | verified |

The named defect was repaired — `updated_at` appears twice in attempt 1 and
zero times in attempt 2. Three `order_line_items` routes were deleted in the
process, and the verdict is still `verified: true`, correctly: the gate asserts
soundness, and a module with fewer routes is sound. Deleting a route is a valid
way to stop referencing a column that does not exist.

Reproduce the route counts from the files themselves:

```
grep -oE 'router\.(get|post|put|delete)\("[^"]+"' ../../v4-orders.js.txt   # 13
grep -oE 'router\.(get|post|put|delete)\("[^"]+"' attempt-2.js.txt         # 10
```

## Two honesty notes on `transcript.json`

1. **It has no `routeCount` field.** That field was added to `reflect.js`
   *after* this run, in response to what this run exposed. The file is kept
   exactly as the run wrote it rather than back-filled, because a transcript
   edited to match later code is not evidence of anything. The 13 and 10 in the
   table above are computed post-hoc from the module files, by the command
   above — reproducible, but not measured by the loop at the time.

2. **`code` reads `"(emitted, see attempt files)"`.** The runner substituted
   that string for the emitted module before serialising, to avoid storing the
   same ~4 kB twice. Everything else is the loop's output untouched.

## Caveat carried from the logbook

The user prompt on a repair was the DDL, then the line "Your previous attempt at
this task was rejected by an automated check.", then the feedback verbatim.
That framing sentence is an **uncontrolled variable**: this run supports
"the model repaired from the critique plus that sentence", not "from the
critique alone". See limitation 2 of the logbook entry.
