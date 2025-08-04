import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'edge',
    environment: 'edge-runtime',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});