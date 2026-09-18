import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const siteHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host
      : null;
  } catch {
    return null;
  }
})();

const allowedOrigins = ["localhost:3000"];
if (siteHost) allowedOrigins.push(siteHost);
for (const host of process.env.STOREFRONT_ALLOWED_ORIGINS?.split(",") ?? []) {
  const trimmed = host.trim();
  if (trimmed) allowedOrigins.push(trimmed);
}

// Hostinger's Next.js preset runs `next start` against `.next`.
// Standalone output breaks that and causes 503s unless entry is `server.js`.
const useStandalone = process.env.HOSTINGER_STANDALONE === "1";

const nextConfig = {
  ...(useStandalone
    ? {
        output: "standalone",
        outputFileTracingRoot: path.join(__dirname, "../.."),
      }
    : {}),
  // Keep IMAP/mail packages outside the RSC bundler.
  serverExternalPackages: ["imapflow", "mailparser", "cloudinary"],
  // Unblock Hostinger deploys while Next 16 route/params typings are caught up.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
  ...(process.env.NEXT_BASE_PATH
    ? {
        basePath: process.env.NEXT_BASE_PATH,
        assetPrefix: process.env.NEXT_ASSET_PREFIX || process.env.NEXT_BASE_PATH,
      }
    : {}),
  images: {
    // Hostinger/LiteSpeed returns 400 for /_next/image on local /public paths.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "a0.muscache.com" },
      { protocol: "https", hostname: "a1.muscache.com" },
      { protocol: "https", hostname: "a2.muscache.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
