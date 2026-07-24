import { synthesiseSchema } from "./agents/schemaSynthesiser.js";

const prompt =
  "Create a PostgreSQL table for users with id, email and created_at columns";

const result = await synthesiseSchema(prompt);
console.log(result);
