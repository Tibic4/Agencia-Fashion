import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import ClientProviders from "@/components/ClientProviders";
import CookieBanner from "@/components/CookieBanner";
import "./globals.css";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  // FASE 5.13: themeColor com variantes light/dark
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a12" },
  ],
};

// FASE 5.4: metadataBase resolve URLs relativas de OG/Twitter corretamente
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://crialook.com.br",
  ),
  title: {
    default: "CriaLook — Transforme fotos de roupa em campanhas prontas",
    template: "%s | CriaLook",
  },
  description:
    "Só com uma foto, a IA gera textos, criativos com modelo virtual e estratégias de marketing prontas para postar. Feito para lojistas de moda brasileiros.",
  // FASE 5.11: keywords removido (Google ignora desde 2009)
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icon-192.png",
  },
  // FASE 5.5: canonical default para home
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "CriaLook — Marketing de moda com inteligência artificial",
    description:
      "Foto da roupa → campanha completa pronta para postar. Textos, criativos e estratégias para Instagram, WhatsApp e Meta Ads.",
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "CriaLook",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CriaLook — Transforme fotos de roupa em campanhas prontas",
      },
    ],
  },
  // FASE 5.7: bloco twitter/X separado
  twitter: {
    card: "summary_large_image",
    title: "CriaLook — Marketing de moda com IA",
    description: "Foto → campanha completa em 60s. Para lojistas de moda.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  applicationName: "CriaLook",
  authors: [{ name: "CriaLook" }],
};

// JSON-LD structured data (FASE 5.1, 5.2)
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "CriaLook",
  url: "https://crialook.com.br",
  logo: "https://crialook.com.br/icon-512.png",
  sameAs: [
    // preencher com redes sociais reais
  ],
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "CriaLook",
  operatingSystem: "Web",
  applicationCategory: "BusinessApplication",
  offers: [
    {
      "@type": "Offer",
      name: "Teste na Prática",
      price: "19.90",
      priceCurrency: "BRL",
    },
    {
      "@type": "Offer",
      name: "Essencial",
      price: "179.00",
      priceCurrency: "BRL",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "359.00",
      priceCurrency: "BRL",
    },
    {
      "@type": "Offer",
      name: "Business",
      price: "749.00",
      priceCurrency: "BRL",
    },
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    reviewCount: "50",
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
          logoBox: { height: "80px" },
          logoImage: { maxHeight: "80px", maxWidth: "200px" },
        },
      }}
    >
      <html lang="pt-BR" className={`${inter.variable} ${outfit.variable} h-full antialiased`}>
        <head>
          {/* FASE 4.6: preconnect/dns-prefetch para hosts críticos */}
          <link rel="preconnect" href="https://emybirklqhonqodzyzet.supabase.co" crossOrigin="anonymous" />
          <link rel="dns-prefetch" href="https://emybirklqhonqodzyzet.supabase.co" />
          <link rel="dns-prefetch" href="https://clerk.crialook.com.br" />
          <link rel="dns-prefetch" href="https://api.mercadopago.com" />
          {/* JSON-LD — SEO + AEO */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
          />
        </head>
        <body className="min-h-full flex flex-col">
          {/* FASE 6.1: skip-link para acessibilidade (teclado/screenreader) */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:rounded focus:shadow-lg focus:outline focus:outline-2 focus:outline-blue-600"
          >
            Pular para o conteúdo
          </a>
          <ClientProviders>
            {children}
          </ClientProviders>
          <CookieBanner />
        </body>
      </html>
    </ClerkProvider>
  );
}
