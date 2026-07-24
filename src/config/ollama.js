export async function generate(prompt, { system, options } = {}) {
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
  });
  const data = await res.json();
  return data.response;
}
