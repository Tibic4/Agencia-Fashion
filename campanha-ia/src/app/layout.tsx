import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import { PostHogProvider } from "@/lib/analytics/posthog";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CriaLook — Transforme fotos de roupa em campanhas prontas",
  description:
    "Tire uma foto da sua peça, informe o preço e receba textos, criativos e estratégias de marketing prontas em 60 segundos. Feito para lojistas de moda brasileiros.",
  keywords: [
    "crialook",
    "campanha moda ia",
    "marketing moda",
    "ia para lojistas",
    "criativo instagram",
    "marketing roupa",
  ],
  openGraph: {
    title: "CriaLook — Marketing de moda com inteligência artificial",
    description:
      "Foto + preço = campanha completa em 60 segundos. Textos, criativos e estratégias para Instagram, WhatsApp e Meta Ads.",
    type: "website",
    locale: "pt_BR",
    url: "https://crialook.com.br",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={ptBR}>
      <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col">
          <PostHogProvider>{children}</PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
