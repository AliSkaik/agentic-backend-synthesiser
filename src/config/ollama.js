export async function generate(prompt) {
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'qwen2.5-coder:7b', prompt, stream: false }),
  });
  const data = await res.json();
  return data.response;
}