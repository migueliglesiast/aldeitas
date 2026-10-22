import "./globals.css";
import type { ReactNode } from "react";
import ParallaxBackground from "../components/ParallaxBackground";
import ContentContainer from "../components/ContentContainer";
import PortalHeader from "../components/PortalHeader";
import PortalFooter from "../components/PortalFooter";
import { HotelProvider } from "../lib/hotel-context";
import { LocaleProvider } from "../lib/i18n/locale-context";
import { StorefrontProvider } from "../lib/storefront-context";
import { getStorefrontFromHeaders } from "../lib/storefront";
import StorefrontFooter from "../components/storefront/StorefrontFooter";
import StorefrontTheme from "../components/storefront/StorefrontTheme";
import type { Metadata } from "next";
import localFont from "next/font/local";

const inter = localFont({
  src: "./fonts/inter-latin-var.woff2",
  weight: "100 900",
  variable: "--font-sans",
});
const fraunces = localFont({
  src: "./fonts/fraunces-latin-var.woff2",
  weight: "100 900",
  variable: "--font-poster",
});
const jakarta = localFont({
  src: "./fonts/plus-jakarta-sans-latin-var.woff2",
  weight: "200 800",
  variable: "--font-display",
});

export async function generateMetadata(): Promise<Metadata> {
  const storefront = await getStorefrontFromHeaders();
  if (storefront) {
    return {
      title: storefront.name,
      description: storefront.storefrontTagline ?? `${storefront.name} · ${storefront.location}`,
      icons: { icon: storefront.logoImageUrl ?? "/images/aldeitas_logo.png" },
    };
  }
  return {
    title: "Aldeitas",
    description: "Browse, compare, and reserve boutique stays.",
    icons: {
      icon: "/images/aldeitas_logo.png",
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const storefront = await getStorefrontFromHeaders();

  return (
    <html lang="es" id="top">
      <body className={`${inter.variable} ${jakarta.variable} ${fraunces.variable} min-h-screen bg-paper font-sans text-ink antialiased`}>
        <LocaleProvider>
          <HotelProvider>
            <StorefrontProvider hotel={storefront}>
              <StorefrontTheme />
              <ParallaxBackground />
              <PortalHeader />
              <ContentContainer>{children}</ContentContainer>
              {storefront ? <StorefrontFooter /> : <PortalFooter />}
            </StorefrontProvider>
          </HotelProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
