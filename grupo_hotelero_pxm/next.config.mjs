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
if (process.env.VERCEL_URL) allowedOrigins.push(process.env.VERCEL_URL);

const nextConfig = {
  // Standalone is for Docker/self-hosted; Vercel uses its own runtime.
  ...(!process.env.VERCEL ? { output: "standalone" } : {}),
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
  // Only set basePath and assetPrefix if explicitly provided (for production deployments)
  ...(process.env.NEXT_BASE_PATH ? {
    basePath: process.env.NEXT_BASE_PATH,
    assetPrefix: process.env.NEXT_ASSET_PREFIX || process.env.NEXT_BASE_PATH,
  } : {}),
  images: {
    // keep remote images working in dev and prod
    unoptimized: false,
    remotePatterns: [
      { protocol: 'https', hostname: 'a0.muscache.com' },
      { protocol: 'https', hostname: 'a1.muscache.com' },
      { protocol: 'https', hostname: 'a2.muscache.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' }
    ]
  }
}

export default nextConfig


