import { defineConfig } from 'tsup';

export default defineConfig([
  // Main build for Node.js environment
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: false,
    sourcemap: true,
    outDir: 'dist',
    clean: true,
  },
  // Browser build using ollama/browser
  {
    entry: {
      'index.browser': 'src/index.browser.ts',
    },
    format: ['cjs', 'esm'],
    dts: false,
    sourcemap: true,
    outDir: 'dist',
    clean: false,
    platform: 'browser',
    target: 'es2020',
    external: ['ollama/browser', '@ai-sdk/provider', '@ai-sdk/provider-utils'],
  },
]);
