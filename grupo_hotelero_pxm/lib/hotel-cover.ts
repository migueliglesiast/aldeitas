type HotelCoverSource = {
  name: string;
  coverImageUrl?: string | null;
  logoImageUrl?: string | null;
  images?: Array<{ url: string }>;
};

export function slugifyHotelName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getHotelCoverCandidates(hotel: HotelCoverSource): string[] {
  const urls: string[] = [];

  if (hotel.coverImageUrl && hotel.coverImageUrl !== hotel.logoImageUrl) {
    urls.push(hotel.coverImageUrl);
  }

  for (const image of hotel.images ?? []) {
    if (image.url && image.url !== hotel.logoImageUrl && !urls.includes(image.url)) {
      urls.push(image.url);
    }
  }

  const slug = slugifyHotelName(hotel.name);
  for (const path of [
    `/images/hotels/${slug}/cover.jpg`,
    `/images/hotels/${slug}/cover.jpeg`,
    `/images/hotels/${slug}/cover.png`,
    `/images/hotels/${slug}/cover.webp`,
  ]) {
    if (!urls.includes(path)) {
      urls.push(path);
    }
  }

  return urls;
}

export function getHotelCoverImageUrl(hotel: HotelCoverSource): string | null {
  return getHotelCoverCandidates(hotel)[0] ?? null;
}
