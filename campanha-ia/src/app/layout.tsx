import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import ClientProviders from "@/components/ClientProviders";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-display",
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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
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
    <ClerkProvider
      localization={ptBR}
      appearance={{
        layout: {
          logoImageUrl: "/clerk-logo.png",
          logoPlacement: "inside",
        },
        elements: {
          logoBox: {
            height: "80px",
          },
          logoImage: {
            maxHeight: "80px",
            maxWidth: "200px",
          },
        },
      }}
    >
      <html lang="pt-BR" className={`${dmSans.variable} ${playfair.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col">
          <ClientProviders>
            {children}
          </ClientProviders>
        </body>
      </html>
    </ClerkProvider>
  );
}

