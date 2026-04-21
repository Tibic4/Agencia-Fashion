import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import ClientProviders from "@/components/ClientProviders";
import "./globals.css";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: "CriaLook — Transforme fotos de roupa em campanhas prontas",
  description:
    "Só com uma foto, a IA gera textos, criativos com modelo virtual e estratégias de marketing prontas pra postar. Feito para lojistas de moda brasileiros.",
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
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
  openGraph: {
    title: "CriaLook — Marketing de moda com inteligência artificial",
    description:
      "Foto da roupa → campanha completa pronta pra postar. Textos, criativos e estratégias para Instagram, WhatsApp e Meta Ads.",
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
      signInFallbackRedirectUrl="/gerar"
      signUpFallbackRedirectUrl="/gerar"
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
      <html lang="pt-BR" className={`${inter.variable} ${outfit.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col">
          <ClientProviders>
            {children}
          </ClientProviders>
        </body>
      </html>
    </ClerkProvider>
  );
}
