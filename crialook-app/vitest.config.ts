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
      // Phase 02 D-11: components/historico/ holds the regenerate-reason
      // picker (Gorhom Bottom Sheet). Tests live next to the component so
      // co-location stays even though we only ship Vitest for one folder
      // today; expand here when more components/* dirs grow tests.
      'components/historico/__tests__/**/*.{test,spec}.{ts,tsx}',
      // Phase 07 D-01..D-05: components/__tests__/ holds the ModelBottomSheet
      // delete-affordance contract test (F-11). Same Gorhom + DOM-stub pattern
      // as RegenerateReasonPicker; kept generic so future component tests at
      // components/__tests__/*.test.tsx are auto-picked-up.
      'components/__tests__/**/*.{test,spec}.{ts,tsx}',
      // M2 Phase 02 D-03: scripts/__tests__/ holds tests for build/CI helpers
      // like check-legal-drift.js. Plain JS allowed because the scripts are
      // CommonJS Node entrypoints, not TypeScript modules.
      'scripts/__tests__/**/*.{test,spec}.{js,ts}',
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
        // Phase 3 D-10: ratchet ativado em CI via --coverage. Os pisos antigos
        // (35/35/30/35) eram aspiracionais — `npm test --coverage` mostrou
        // cobertura real em ~24% lines / ~19% branches / ~15% functions porque
        // muitos hooks de tela ainda não têm teste (camera, biometric, push).
        // Pisos ajustados pra atual - 2pp como ratchet honesto.
        //
        // Phase 6 (2026-05-04): testes novos (billing, auth, deep-link UUID
        // via vitest; ErrorBoundary + TabErrorBoundary via jest — não contam
        // pra esse pool) subiram cobertura. Medidas reais pós-Phase 6:
        // Stmts 27.67 / Branches 23.46 / Funcs 18.56 / Lines 29.18.
        //
        // M2 Phase 03 (2026-05-04): +68 testes (169/169 pass) elevaram pra
        // 37.51% lines / 32.31% branches / 27.27% functions / 35.89% statements.
        // D-10 spec ATINGIDO em lines (35). FUNCTIONS gap honesto: D-10 alvo
        // era 35, atual 27 — RN screen hooks (camera/biometric/push/navigation/
        // notifications side-effects) precisam de Maestro/Detox pra cobrir
        // (vitest jsdom não consegue executar a stack RN nativa real). Esses
        // hooks são onde a maioria das funções não testadas vivem. Defer pra
        // ROADMAP parking-lot e2e: "Maestro/Detox e2e: explicit defer, blocks
        // Phase 3 D-10 spec to honest max" (.planning/M2-NOTES.md §What's NOT).
        lines: 37,
        functions: 27,
        branches: 32,
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
