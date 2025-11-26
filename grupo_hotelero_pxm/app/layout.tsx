import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import AuthButton from "../components/AuthButton";

export const metadata = {
  title: "Casa Yahua",
  description: "Browse, compare, and reserve boutique stays.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-6">
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


