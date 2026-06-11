import "./globals.css";
import type { ReactNode } from "react";
import SiteHeader from "../components/SiteHeader";
import ParallaxBackground from "../components/ParallaxBackground";
import ContentContainer from "../components/ContentContainer";
import { HotelProvider } from "../lib/hotel-context";
import { LocaleProvider } from "../lib/i18n/locale-context";
import { Poppins } from "next/font/google";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "600", "700"] });

export const metadata = {
  title: "Aldeitas",
  description: "Browse, compare, and reserve boutique stays.",
  icons: {
    icon: "/images/aldeitas_logo.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.className} min-h-screen text-slate-700`}>
        <LocaleProvider>
          <HotelProvider>
            <ParallaxBackground />
            <SiteHeader />
            <ContentContainer>{children}</ContentContainer>
          </HotelProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
