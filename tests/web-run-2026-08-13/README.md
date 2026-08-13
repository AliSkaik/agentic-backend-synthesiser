# 2026-08-13 — web layer, both terminal states

Evidence for Objective 4, produced through the HTTP interface rather than by
calling the pipeline directly.

## Success

Description: *"An online shop with customers, orders and the line items on each
order."*

| | |
| --- | --- |
| outcome | **verified** |
| Agent 1 attempts | 1 |
| Agent 2 attempts | 2 (attempt 1 failed Layer 1 `SyntaxError`, 13 routes; attempt 2 verified, 15 routes) |
| **ingestion to archive** | **586 114 ms** |
| archive | 1 847 bytes, 3 entries |

`586 114 ms` is the first end-to-end measurement of metric 4 as §2.8 defines it:
wall clock from ingestion of the natural-language input to serialisation of the
output archive. Nothing before this layer could take that measurement, because
no archive existed.

The attempt counts reproduce the Scenario B orders arm exactly — 1 and 2, with
the same Layer 1 `SyntaxError` on the first module and the same 13→15 route
change on repair. That is determinism confirming itself through an entirely
different code path: the web layer calls the same loops with the same seed and
reaches the same place.

Files: `backend.zip` and its extracted contents — `schema.sql`, `routes.js`,
`verification-report.json`. `status-success.json` is the job status as the
browser received it.

## Failure

Description: *"A blog with users, posts and tags. Posts belong to a user and can
have many tags."* — known to fail Layer 0 on `CREATE TYPE tag_name AS
VARCHAR(255)`.

```
status        failed
stage         Agent 1: unverified after 5 attempt(s)
failedLayer   0
download      null

GET /download/<id>   ->   HTTP 500
{ "error": "The pipeline did not converge; no verified artefacts exist",
  "outcome": "unverified", "failedLayer": 0,
  "detail": { "type": "UnexpectedToken", ... } }
```

No artefacts were written, so the rollback §2.6.2 describes is structural rather
than a compensating action: there is nothing to discard because nothing was
created. The download route refuses independently of the status endpoint, so the
guarantee cannot be circumvented by requesting the URL directly.
