import {
  sortImageUrlsByReliability,
  staticHotelCoverPaths,
} from "@/lib/image-url";

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

  const galleryUrls: string[] = [];
  for (const image of hotel.images ?? []) {
    if (image.url && image.url !== hotel.logoImageUrl && !galleryUrls.includes(image.url)) {
      galleryUrls.push(image.url);
    }
  }

  const remoteGallery = sortImageUrlsByReliability(galleryUrls).filter((url) =>
    /^https?:\/\//i.test(url)
  );
  const localGallery = sortImageUrlsByReliability(galleryUrls).filter(
    (url) => !/^https?:\/\//i.test(url)
  );

  const slug = slugifyHotelName(hotel.name);
  const staticCovers = staticHotelCoverPaths(slug);

  for (const url of [...remoteGallery, ...staticCovers, ...localGallery]) {
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
}

export function getHotelCoverImageUrl(hotel: HotelCoverSource): string | null {
  return getHotelCoverCandidates(hotel)[0] ?? null;
}
