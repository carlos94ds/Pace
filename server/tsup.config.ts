import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: 'esm',
  target: 'node24',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // The shared package is TypeScript source, so it is bundled into the server build.
  noExternal: ['@pace/shared'],
});
