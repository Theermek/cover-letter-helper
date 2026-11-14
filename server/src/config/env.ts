/**
 * Environment configuration, validated once at startup.
 *
 * Reading process.env scattered through the code means a typo surfaces as
 * `undefined` deep inside a request, hours later. Here the whole environment is
 * parsed by a zod schema before the server starts listening: a missing or
 * malformed variable kills the process immediately with a readable message.
 */

import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, 'нужна строка подключения к Postgres'),

  // Long enough that it cannot be guessed; the extension sends it as a bearer.
  API_TOKEN: z.string().min(16, 'токен должен быть не короче 16 символов'),

  // Empty in development: the extension id changes whenever the unpacked
  // folder moves, so CORS falls back to allowing any chrome-extension origin.
  EXTENSION_ID: z.string().default(''),

  OPENAI_API_KEY: z.string().default(''),
  ANTHROPIC_API_KEY: z.string().default(''),
  GEMINI_API_KEY: z.string().default(''),

  DEFAULT_PROVIDER: z.enum(['openai', 'anthropic', 'gemini']).default('openai'),
  DEFAULT_MODEL: z.string().default(''),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.') || '(корень)'}: ${issue.message}`)
    .join('\n');

  console.error(
    `Сервер не запущен: переменные окружения заданы неверно.\n${details}\n` +
      'Скопируйте server/.env.example в server/.env и заполните значения.',
  );
  process.exit(1);
}

export const env: Env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
