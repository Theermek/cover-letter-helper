/**
 * Server entry point: starts what app.ts assembled.
 *
 * Shutdown is handled explicitly. A container stops its process with SIGTERM,
 * and without this the process would die mid-request and leave database
 * connections hanging until Postgres timed them out.
 */

import type { Server } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeDatabase, pingDatabase } from './db/client.js';

const start = async (): Promise<void> => {
  // Checked once at startup: better a loud warning now than a confusing 503 on
  // the first real request.
  try {
    await pingDatabase();
    console.log('[db] соединение установлено');
  } catch (error) {
    console.warn(
      '[db] база недоступна:',
      error instanceof Error ? error.message : error,
      '\n      Поднимите её командой `docker compose up -d` в корне проекта.',
    );
  }

  const server: Server = createApp().listen(env.PORT, () => {
    console.log(`[server] слушает http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string): void => {
    console.log(`\n[server] ${signal}: останавливаюсь`);
    server.close(() => {
      void closeDatabase().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

void start();
