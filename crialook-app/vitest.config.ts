import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Why fileURLToPath em vez de `.pathname`: em Windows com path contendo
// espaço (ex: "Nova pasta"), `.pathname` retorna `/D:/Nova%20pasta/...` —
// %20 codificado + leading slash. Vite não resolve aliases nessa forma e
// quebra `@/lib/api` etc. fileURLToPath devolve `D:\Nova pasta\...` correto.
const projectRoot = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  test: {
    include: [
      'lib/__tests__/**/*.{test,spec}.{ts,tsx}',
      'hooks/__tests__/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**'],
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    // Coverage: roda sob demanda com `npm test -- --coverage`. Não enforce no
    // CI ainda (cobertura inicial baixa em telas RN); o piso aqui é o que
    // já passa hoje e o teto é a meta de 12 meses. Quando subir, ajustar.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}'],
      exclude: ['**/*.test.*', '**/__tests__/**', '**/node_modules/**'],
      thresholds: {
        // Pisos atuais — não quebrar; mexer pra cima conforme cobertura cresce.
        lines: 35,
        functions: 35,
        branches: 30,
        statements: 35,
      },
    },
  },
  resolve: {
    alias: {
      '@': projectRoot,
    },
  },
});
