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
        lines: 19,
        functions: 24,
        branches: 11,
        statements: 18,
      },
    },
  },
});
