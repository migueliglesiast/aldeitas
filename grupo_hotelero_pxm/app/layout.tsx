import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import SiteHeader from "../components/SiteHeader";
import StorefrontHeader from "../components/StorefrontHeader";
import ParallaxBackground from "../components/ParallaxBackground";
import ContentContainer from "../components/ContentContainer";
import { HotelProvider } from "../lib/hotel-context";
import { LocaleProvider } from "../lib/i18n/locale-context";
import { StorefrontProvider } from "../lib/storefront-context";
import { getStorefrontFromHeaders } from "../lib/storefront";
import { Poppins } from "next/font/google";

export const dynamic = "force-dynamic";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "600", "700"] });

export async function generateMetadata(): Promise<Metadata> {
  const storefront = await getStorefrontFromHeaders();
  if (storefront) {
    return {
      title: storefront.name,
      description: storefront.description,
      icons: storefront.logoImageUrl
        ? { icon: storefront.logoImageUrl }
        : undefined,
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.className} min-h-screen text-slate-700`}>
        <LocaleProvider>
          <HotelProvider>
            <StorefrontProvider hotel={storefront}>
              <ParallaxBackground />
              {storefront ? <StorefrontHeader /> : <SiteHeader />}
              <ContentContainer>{children}</ContentContainer>
            </StorefrontProvider>
          </HotelProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
