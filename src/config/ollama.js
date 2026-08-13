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

// Thrown when Ollama answers with a non-2xx status. Without this check the body
// of an error response still parses as JSON, `data.response` is `undefined`,
// and the fault only surfaces further downstream as a TypeError inside
// whichever caller first treats the result as a string. That reaches the loop
// as `errorType: "TypeError"`, which names the wrong thing entirely and puts
// the detection of a transport fault inside a function whose job is stripping
// markdown fences. The status is known here, so it is raised here.
export class OllamaResponseError extends Error {
  constructor(status, statusText) {
    super(`Ollama returned HTTP ${status}${statusText ? ` ${statusText}` : ""}`);
    this.name = "OllamaResponseError";
    this.type = "OllamaResponse";
    this.status = status;
  }
}

/**
 * As generate(), but returns the whole response body rather than only the text.
 *
 * Ollama reports `prompt_eval_count` and `eval_count` on every non-streaming
 * response, and metric 5 of the evaluation is token consumption across a full
 * trajectory. generate() throws those away, and every existing caller depends on
 * receiving a bare string, so the telemetry is added alongside rather than by
 * changing what generate() returns.
 *
 * @returns {Promise<{response: string, promptTokens: number|null,
 *                    evalTokens: number|null, totalDurationMs: number|null}>}
 */
export async function generateWithMetrics(prompt, options = {}) {
  const body = await request(prompt, options);
  return {
    response: body.response,
    promptTokens: body.prompt_eval_count ?? null,
    evalTokens: body.eval_count ?? null,
    // Ollama reports durations in nanoseconds.
    totalDurationMs: body.total_duration ? Math.round(body.total_duration / 1e6) : null,
  };
}

export async function generate(prompt, options = {}) {
  const body = await request(prompt, options);
  return body.response;
}

async function request(
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
        stream: true,
        options,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new OllamaResponseError(res.status, res.statusText);

    // Streamed, and not for latency: undici's bodyTimeout defaults to 300 s and
    // measures the gap between chunks. A non-streaming request sends nothing
    // until generation completes, so any generation longer than five minutes had
    // its connection killed and surfaced as `fetch failed` regardless of the
    // timeout configured above, which was never in effect. Streaming resets that
    // timer on every token.
    //
    // Transport only: same model, prompt, options and seed, so the determinism
    // property is untouched. Verified byte-identical against a non-streaming
    // request rather than assumed.
    const decoder = new TextDecoder();
    let buffer = "";
    let response = "";
    let final = {};

    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim() === "") continue;
        const part = JSON.parse(line);
        if (typeof part.response === "string") response += part.response;
        if (part.done) final = part;
      }
    }
    if (buffer.trim() !== "") {
      const part = JSON.parse(buffer);
      if (typeof part.response === "string") response += part.response;
      if (part.done) final = part;
    }

    return { ...final, response };
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
