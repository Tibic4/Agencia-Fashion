import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['lib/__tests__/**/*.{test,spec}.ts', 'hooks/__tests__/**/*.{test,spec}.ts'],
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': new URL('./', import.meta.url).pathname,
    },
  },
});
