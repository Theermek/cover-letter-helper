import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const here = dirname(fileURLToPath(import.meta.url));
const page = (name: string) => resolve(here, `${name}.html`);

/**
 * MV3 requires predictable file names: manifest.json references background.js by
 * path, so entry names must not be hashed. Shared chunks are hashed as usual --
 * a module service worker may static-import them.
 */
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome120',
    sourcemap: true,
    rollupOptions: {
      input: {
        popup: page('popup'),
        options: page('options'),
        stats: page('stats'),
        editor: page('editor'),
        background: resolve(here, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
