import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { siteOriginForHost } from "@/lib/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = siteOriginForHost((await headers()).get("host"));
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/booking/", "/calendar/"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
