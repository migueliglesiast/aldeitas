import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import AuthButton from "../components/AuthButton";
import ParallaxBackground from "../components/ParallaxBackground";

export const metadata = {
  title: "Casa Yahua",
  description: "Browse, compare, and reserve boutique stays.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-gray-900">
        <ParallaxBackground />
        <div className="mx-auto max-w-7xl px-4 py-6 bg-white/70 backdrop-blur-sm rounded-lg">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/" className="text-xl font-semibold">Casa Yahua</Link>
            <AuthButton />
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}


