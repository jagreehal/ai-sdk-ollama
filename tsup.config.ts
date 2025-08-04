import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'node18',
  external: ['ollama', '@ai-sdk/provider', '@ai-sdk/provider-utils', 'ai'],
  treeshake: true,
  bundle: true,
  platform: 'node',
});
