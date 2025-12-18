import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import AuthButton from "../components/AuthButton";
import ParallaxBackground from "../components/ParallaxBackground";
import ContentContainer from "../components/ContentContainer";
import { HotelProvider } from "../lib/hotel-context";
import { Poppins, Playfair_Display, Comfortaa, Dancing_Script, Great_Vibes } from "next/font/google";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "600", "700"] });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700"] });
const comfortaa = Comfortaa({ subsets: ["latin"], weight: ["700"] });
const dancingScript = Dancing_Script({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const greatVibes = Great_Vibes({ subsets: ["latin"], weight: ["400"] });

export const metadata = {
  title: "Aldeitas",
  description: "Browse, compare, and reserve boutique stays.",
  icons: {
    icon: "/images/aldeitas_logo.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${poppins.className} min-h-screen text-slate-700`}>
        <HotelProvider>
          <ParallaxBackground />
          {/* Title and auth sit above the content container, scroll with the page */}
          <div className="mx-auto max-w-7xl px-4 mt-[4vh] md:mt-[6vh]">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-2">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/images/aldeitas_logo.png"
                  alt="Las Aldeitas logo"
                  width={48}
                  height={48}
                  priority
                  className="h-10 w-10 md:h-12 md:w-12 object-contain"
                />
                <span className={`${comfortaa.className} text-3xl md:text-5xl leading-tight font-bold text-[#00a19c]`}>
                  Aldeitas
                </span>
              </Link>
              <div className="self-start md:self-auto">
                <AuthButton />
              </div>
            </div>
            <p className={`${dancingScript.className} text-2xl md:text-3xl text-gray-600 md:ml-[60px]`}>
              Long term stays in unique places
            </p>
          </div>

          <ContentContainer>
            {children}
          </ContentContainer>
        </HotelProvider>
      </body>
    </html>
  );
}


