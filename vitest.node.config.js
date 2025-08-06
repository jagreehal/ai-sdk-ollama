import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'node',
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/test-*.ts',
        'vitest.*.config.*',
        'tsup.config.ts',
      ],
    },
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});
