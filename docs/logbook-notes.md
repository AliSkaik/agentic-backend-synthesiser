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
