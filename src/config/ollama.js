// The Ollama generate wrapper.
//
// The timeout is explicit rather than inherited. With `stream: false` Ollama
// sends no response headers until generation has finished, so an entire Agent 2
// generation (181-244 s observed in Week 8) sits inside undici's default
// header timeout of ~300 s. A marginally larger schema would abort the run with
// `UND_ERR_HEADERS_TIMEOUT`, which reads as a network fault rather than as a
// limit that was chosen, and the N=5 loop multiplies that exposure fivefold.
//
// 600 s is well clear of the observed range, so a breach means something is
// genuinely wrong rather than merely slow. The default lives here, not only in
// the caller, so a caller that omits it is still protected.
export const DEFAULT_TIMEOUT_MS = 600_000;

// Thrown only on timeout, so a driver can classify it as an infrastructure
// failure rather than as the model having produced bad code. Those two are
// different outcomes and conflating them would corrupt a convergence rate.
export class OllamaTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`Ollama did not respond within ${timeoutMs} ms`);
    this.name = "OllamaTimeoutError";
    this.type = "OllamaTimeout";
    this.timeoutMs = timeoutMs;
  }
}

export async function generate(
  prompt,
  { system, options, timeoutMs = DEFAULT_TIMEOUT_MS } = {}
) {
  try {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5-coder:7b",
        system,
        prompt,
        stream: false,
        options,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await res.json();
    return data.response;
  } catch (err) {
    // AbortSignal.timeout aborts with a TimeoutError DOMException. Undici
    // surfaces it either directly or wrapped in a TypeError whose `cause` is
    // the DOMException, so both shapes are checked.
    if (err?.name === "TimeoutError" || err?.cause?.name === "TimeoutError") {
      throw new OllamaTimeoutError(timeoutMs);
    }
    throw err;
  }
}
