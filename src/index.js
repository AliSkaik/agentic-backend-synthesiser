import { synthesiseSchema } from "./agents/schemaSynthesiser.js";

const prompt =
  "Create a PostgreSQL table for users with id, email and created_at columns";

const start = performance.now();
const ddl = await synthesiseSchema(prompt);
console.log(ddl);
console.log(`Latency: ${(performance.now() - start).toFixed(0)} ms`);
