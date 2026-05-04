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
        // Stmts 27.67 / Branches 23.46 / Funcs 18.56 / Lines 29.18. Pisos
        // elevados pro floor das medidas (round-down) — bloqueia regressão
        // dos novos testes sem ficar acima da cobertura real (que quebraria
        // o CI no commit que sobe os pisos). D-10 spec target era 30/35
        // (lines/funcs); lines está perto (29 vs 30) mas funcs ainda longe
        // (18 vs 35) — manter o ratchet honesto agora, subir mais quando
        // hooks de tela (camera, biometric, push) ganharem cobertura.
        // Valores anteriores: 22 / 13 / 17 / 21 (lines/funcs/branches/stmts).
        lines: 29,
        functions: 18,
        branches: 23,
        statements: 27,
      },
    },
  },
  resolve: {
    alias: {
      '@': projectRoot,
    },
  },
});
