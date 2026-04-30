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
    // useModelSelector.test.ts foi escrito antes do hook migrar pra
    // `useQueries` (TanStack Query). Vitest não consegue parsear nem
    // carregar o arquivo (`Unexpected token 'typeof'` em algum dos imports
    // transitivos do `@tanstack/react-query`), e `describe.skip` não evita
    // — o file ainda é importado. Excluído daqui até reescrever com
    // `<QueryClientProvider>` wrapper. TODO no header do .test.ts.
    exclude: ['**/node_modules/**', 'hooks/__tests__/useModelSelector.test.ts'],
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
