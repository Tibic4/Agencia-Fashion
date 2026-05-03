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
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
    exclude: ["node_modules", ".next", "scripts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
      exclude: ["**/*.test.*", "**/__tests__/**", "**/*.types.ts", "**/node_modules/**"],
      thresholds: {
        // Pisos atuais — não quebrar; mexer pra cima quando cobertura crescer.
        // src/lib/ tem boa cobertura em validation/rate-limit/mp-signature;
        // src/app/api/ está fraco — webhooks de pagamento e billing precisam.
        lines: 30,
        functions: 30,
        branches: 25,
        statements: 30,
      },
    },
  },
});
