import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://crialook.com.br";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/sobre", "/termos", "/privacidade", "/dpo", "/subprocessadores", "/consentimento-biometrico"],
        disallow: [
          "/gerar",
          "/historico",
          "/modelo",
          "/configuracoes",
          "/plano",
          "/admin",
          "/editor",
          "/onboarding",
          "/preview",
          "/api/",
          "/monitoring",
          "/monitoring-analytics",
          "/test-konva",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
