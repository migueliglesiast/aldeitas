/** Lower = more likely to work in production (CDN / git static assets). */
export function imageUrlPriority(url: string): number {
  if (/^https?:\/\//i.test(url)) return 0;
  if (url.startsWith("/images/")) return 1;
  if (url.startsWith("/uploads/")) return 2;
  return 3;
}

export function sortImageUrlsByReliability(urls: string[]): string[] {
  return [...urls].sort((a, b) => imageUrlPriority(a) - imageUrlPriority(b));
}

export function staticHotelCoverPaths(slug: string): string[] {
  return [
    `/images/hotels/${slug}/cover.jpg`,
    `/images/hotels/${slug}/cover.jpeg`,
    `/images/hotels/${slug}/cover.png`,
    `/images/hotels/${slug}/cover.webp`,
  ];
}
