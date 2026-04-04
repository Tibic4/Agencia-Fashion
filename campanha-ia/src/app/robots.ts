import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://crialook.com.br";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/gerar", "/historico", "/modelo", "/configuracoes", "/plano", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
