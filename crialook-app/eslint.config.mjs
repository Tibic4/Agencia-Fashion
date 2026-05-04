// Phase 3 D-11 — ESLint flat config para crialook-app.
//
// Espelha a postura de campanha-ia/eslint.config.mjs: regras legacy-prone
// rebaixadas para warning para que o lint seja honesto no dia 1 (zero
// errors, warnings tolerados). Hardening futuro pode subir warn → error
// como decisão de migração explícita.
//
// Base: eslint-config-expo/flat.js — já encapsula RN + TypeScript +
// react-hooks com defaults sensatos para Expo SDK 54.
import { defineConfig, globalIgnores } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";

const eslintConfig = defineConfig([
  ...expoConfig,
  globalIgnores([
    "node_modules/**",
    ".expo/**",
    "dist/**",
    "ios/**",
    "android/**",
    "coverage/**",
    "storybook/**",
    "storybook-static/**",
    "scripts/**",
    "*.config.js",
  ]),
  {
    // React + react-hooks plugins são globais no expo flat config, então
    // estes overrides aplicam pra todo arquivo.
    rules: {
      // Phase 3 D-11: lint must be honest on day 1 (zero errors, warnings OK).
      // Mirrors campanha-ia/eslint.config.mjs posture — relaxar legado sem
      // sacrificar segurança. Hardening gradual em phases futuras.
      "react-hooks/exhaustive-deps": "warn",
      "prefer-const": "warn",
      // Componentes inline em testes (factory functions, render helpers) não
      // precisam de displayName — gera ruído sem valor real. Warning preserva
      // visibilidade sem bloquear CI.
      "react/display-name": "warn",
      // Texto PT-BR com aspas e apóstrofos é orgânico em UI brasileira.
      // Escapar todos seria tedioso e ilegível; warning sinaliza sem travar.
      "react/no-unescaped-entities": "warn",
    },
  },
  {
    // @typescript-eslint só está ativo em ts/tsx/d.ts no expo config; precisa
    // espelhar esse escopo aqui senão eslint reclama do plugin não definido.
    files: ["**/*.ts", "**/*.tsx", "**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
