import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "tests/**/*.test.ts",
      // Phase 02 D-17: evals/run.ts driver tests live alongside the script.
      "evals/**/*.test.ts",
    ],
    exclude: ["node_modules", ".next", "scripts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
      exclude: ["**/*.test.*", "**/__tests__/**", "**/*.types.ts", "**/node_modules/**"],
      thresholds: {
        // Phase 3 D-10: ratchet ativado em CI via --coverage. Os pisos antigos
        // (30/30/25/30) eram aspiracionais — `npm test --coverage` mostrou
        // cobertura real em ~17% lines / ~11% branches / ~24% functions porque
        // src/app/api/ (webhooks pagamento/billing) está sem teste. Pisos
        // ajustados pra atual - 2pp como ratchet honesto: bloqueia regressão
        // sem mentir sobre cobertura. Phase 6 sobe de volta pra 30+ ao adicionar
        // os testes faltantes (auth/billing/webhooks).
        //
        // Phase 02 (Plan 02-05): +40 testes (224/224 pass) elevaram a cobertura
        // pra ~21% lines, ~14% branches, ~27% functions, ~21% statements.
        // Pisos elevados pra current-2pp como ratchet honesto.
        //
        // Phase 04 (Plans 04-01..04-05): +35 testes (259/259 pass) elevaram pra
        // ~22.7% lines, ~15.7% branches, ~29.5% functions, ~22.5% statements.
        // Pisos atualizados pra current-2pp.
        //
        // M2 Phase 03 (2026-05-04): +95 testes (366/366 pass) elevaram pra
        // 30.24% lines / 24.14% branches / 42.49% functions / 30.16% statements.
        // D-10 spec ATINGIDO em lines (30) e functions (30). Pisos elevados
        // ao floor real (round-down) — bloqueia regressão sem ficar acima da
        // cobertura medida (que quebraria CI no commit que sobe os pisos).
        // Branches ainda 6pp abaixo do ideal — gap honesto: muitas rotas API
        // têm error paths não testados (ver QUALITY.md §Coverage Gaps).
        lines: 30,
        functions: 42,
        branches: 24,
        statements: 30,
      },
    },
  },
});
