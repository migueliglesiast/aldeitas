import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import AuthButton from "../components/AuthButton";
import ParallaxBackground from "../components/ParallaxBackground";
import ContentContainer from "../components/ContentContainer";
import { HotelProvider } from "../lib/hotel-context";
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
    <html lang="en">
      <body className={`${inter.variable} ${jakarta.variable} min-h-screen bg-white font-sans text-ink antialiased`}>
        <HotelProvider>
          <ParallaxBackground />
          <header className="sticky top-0 z-50 border-b border-line/60 bg-white/90 backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
              <Link href="/" className="flex items-center gap-2.5">
                <Image
                  src="/images/aldeitas_logo.png"
                  alt="Las Aldeitas logo"
                  width={40}
                  height={40}
                  priority
                  className="h-9 w-9 object-contain md:h-10 md:w-10"
                />
                <span className="hidden flex-col leading-tight sm:flex">
                  <span className="font-display text-2xl font-extrabold tracking-tight text-brand">
                    Aldeitas
                  </span>
                  <span className="text-xs font-medium text-muted">
                    Long term stays in unique places
                  </span>
                </span>
              </Link>
              <div className="shrink-0">
                <AuthButton />
              </div>
            </div>
          </header>

          <ContentContainer>
            {children}
          </ContentContainer>

          <footer className="mt-16 border-t border-line/60 bg-surface">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted md:flex-row md:px-6">
              <p>© {new Date().getFullYear()} Aldeitas · Long term stays in unique places</p>
              <p className="flex items-center gap-4">
                <Link href="/" className="hover:text-ink hover:underline">Home</Link>
                <Link href="/hotel" className="hover:text-ink hover:underline">Browse hotels</Link>
                <Link href="/sign-up" className="hover:text-ink hover:underline">Sign up</Link>
              </p>
            </div>
          </footer>
        </HotelProvider>
      </body>
    </html>
  );
}
