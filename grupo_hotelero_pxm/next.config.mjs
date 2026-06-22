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

const nextConfig = {
  output: "standalone",
  experimental: {
    // Shared hosting (Hostinger/CloudLinux) limits process/thread count.
    workerThreads: false,
    cpus: 1,
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
    // Hostinger/LiteSpeed returns 400 for /_next/image on local /public paths.
    // Direct URLs (/images/..., /uploads/..., remote) are served correctly.
    unoptimized: true,
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


