import "./globals.css";
import type { ReactNode } from "react";
import ParallaxBackground from "../components/ParallaxBackground";
import ContentContainer from "../components/ContentContainer";
import PortalHeader from "../components/PortalHeader";
import PortalFooter from "../components/PortalFooter";
import { HotelProvider } from "../lib/hotel-context";
import { LocaleProvider } from "../lib/i18n/locale-context";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

export const metadata = {
  title: "Aldeitas",
  description: "Browse, compare, and reserve boutique stays.",
  icons: {
    icon: "/images/aldeitas_logo.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${jakarta.variable} min-h-screen bg-white font-sans text-ink antialiased`}>
        <LocaleProvider>
          <HotelProvider>
            <ParallaxBackground />
            <PortalHeader />
            <ContentContainer>{children}</ContentContainer>
            <PortalFooter />
          </HotelProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
