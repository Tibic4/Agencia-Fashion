/**
 * Re-export direto do ShowcaseSection.
 * Como ele já tem "use client", o Next.js trata como Client Component boundary.
 * Não precisa de dynamic() com ssr: false.
 */
export { default } from "@/components/ShowcaseSection";
