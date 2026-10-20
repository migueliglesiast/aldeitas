import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { siteOriginForHost } from "@/lib/site";
import { isPortalHost } from "@/lib/storefront-host";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get("host");
  const origin = siteOriginForHost(host);
  if (!isPortalHost(host)) return [{ url: `${origin}/`, changeFrequency: "weekly", priority: 1 }];

  const pages: MetadataRoute.Sitemap = [
    { url: `${origin}/`, changeFrequency: "daily", priority: 1 },
    { url: `${origin}/ayuda`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${origin}/terminos`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${origin}/privacidad`, changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    const hotels = await prisma.hotel.findMany({
      where: { listings: { some: {} } },
      select: { id: true, updatedAt: true },
    });
    for (const hotel of hotels) {
      pages.push({ url: `${origin}/hotel/${hotel.id}`, lastModified: hotel.updatedAt, priority: 0.7 });
    }
  } catch (error) {
    console.error("[sitemap] could not load hotels:", error);
  }

  return pages;
}
