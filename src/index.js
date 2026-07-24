import { generate } from './config/ollama.js';

const prompt = 'Create a PostgreSQL table for users with id, email and created_at columns';

const result = await generate(prompt);
console.log(result);
