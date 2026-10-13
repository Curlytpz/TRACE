import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().url().optional(),
  EMBEDDING_PROVIDER: z.enum(['disabled', 'openai', 'gemini']).default('disabled'),
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  OPENAI_EMBEDDING_MODEL: z.string().trim().min(1).max(200).default('text-embedding-3-small'),
  GEMINI_API_KEY: z.string().trim().min(1).optional(),
  GEMINI_EMBEDDING_MODEL: z.literal('gemini-embedding-001').default('gemini-embedding-001'),
  GEMINI_EMBEDDING_DIMENSIONS: z.coerce.number().int().min(128).max(3_072).default(768),
  GENERATION_PROVIDER: z.enum(['disabled', 'gemini']).default('disabled'),
  GEMINI_GENERATION_MODEL: z.string().trim().min(1).max(200).default('gemini-2.5-flash'),
});

export function parseEnvironment(source: NodeJS.ProcessEnv) {
  const parsed = environmentSchema.safeParse(source);
  if (!parsed.success) throw new Error('Invalid server environment configuration.');
  return parsed.data;
}

// Always resolve configuration relative to the server package, including when the
// process is launched from the monorepo root or a service manager.
export const serverEnvironmentPath = resolve(dirname(fileURLToPath(import.meta.url)), '../.env');
config({ path: serverEnvironmentPath });
export const env = parseEnvironment(process.env);
