import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://crialook.com.br";
  const now = new Date();

  return [
    { url: baseUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/sobre`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    // /sign-in removido (não agrega SEO), /sign-up com prioridade moderada
    { url: `${baseUrl}/sign-up`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/termos`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/privacidade`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/dpo`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/subprocessadores`, lastModified: now, changeFrequency: "monthly", priority: 0.2 },
    { url: `${baseUrl}/consentimento-biometrico`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
