import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Why fileURLToPath em vez de `.pathname`: em Windows com path contendo
// espaço (ex: "Nova pasta"), `.pathname` retorna `/D:/Nova%20pasta/...` —
// %20 codificado + leading slash. Vite não resolve aliases nessa forma e
// quebra `@/lib/api` etc. fileURLToPath devolve `D:\Nova pasta\...` correto.
const projectRoot = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  test: {
    include: ['lib/__tests__/**/*.{test,spec}.ts', 'hooks/__tests__/**/*.{test,spec}.ts'],
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': projectRoot,
    },
  },
});
