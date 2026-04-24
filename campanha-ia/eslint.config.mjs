import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Scripts de playground/teste manual de IA — não rodam em produção.
    // Mantidos versionados só para histórico/reprodução. Ignoramos no lint
    // porque foram escritos como prototype rápido com muito `any` e legados.
    "scripts/**",
    "scratch/**",
  ]),
  // Rules overrides — relaxar legado sem sacrificar segurança
  {
    rules: {
      // `any` aparece no pipeline IA, model-preview e analytics (código legado).
      // Convertemos para warning para não bloquear CI até migrarmos gradualmente.
      "@typescript-eslint/no-explicit-any": "warn",
      // <img> em previews de upload (data URL / blob) — next/image não suporta bem.
      "@next/next/no-img-element": "warn",
      // Hooks deps — alguns casos deliberados (mount-only effects).
      "react-hooks/exhaustive-deps": "warn",
      // Rules novos do React 19/Next 16 (purity/refs/set-state-in-effect) —
      // muito estritos no legado. Warning para não bloquear CI; migração gradual.
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      // <a href="/..."> vs <Link> — em alguns casos (sign-up externo) é deliberado.
      "@next/next/no-html-link-for-pages": "warn",
      "prefer-const": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
]);

export default eslintConfig;
