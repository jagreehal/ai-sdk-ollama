import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/integration-tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    globals: true,
    environment: 'node',
    testTimeout: 120_000, // 2 minutes for integration tests
    maxConcurrency: 1, // Run integration tests sequentially to avoid overwhelming Ollama
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/integration-tests/**/*'],
    },
  },
});
