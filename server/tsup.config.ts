import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Everything is bundled into one file, which is why imports from ../shared
  // (outside this package) resolve without any path aliases.
  bundle: true,
});
