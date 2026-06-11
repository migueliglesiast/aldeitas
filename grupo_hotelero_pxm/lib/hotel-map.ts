export type HotelCoordinates = {
  lat: number;
  lng: number;
};

export type HotelMapPin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  logoImageUrl?: string | null;
  coverImageUrl?: string | null;
};

/** Fixed bounds covering Tamarindos through Punta Zicatela. */
export const HOTEL_AREA_BOUNDS = {
  southWest: { lat: 15.834, lng: -97.054 },
  northEast: { lat: 15.848, lng: -97.042 },
} as const;

const HOTEL_COORDINATES: Record<string, HotelCoordinates> = {
  "Aldeita Mixteca": { lat: 15.842121, lng: -97.051367 },
  "La Otra Aldeita": { lat: 15.8392, lng: -97.0478 },
  "La Arbolita": { lat: 15.846468, lng: -97.052432 },
  "Nido Escondido": { lat: 15.8458, lng: -97.0519 },
  "Casa Yahua": { lat: 15.842778, lng: -97.048708 },
  "Casa Guadalupe": { lat: 15.841474, lng: -97.048905 },
  "Casa Oaxira": { lat: 15.843057, lng: -97.048809 },
  "Coco By-The-Beach": { lat: 15.838504, lng: -97.046378 },
  "Ranchito Zicatela": { lat: 15.8379, lng: -97.0459 },
  "Espacio Malinxhe": { lat: 15.836421, lng: -97.043732 },
};

export function parseCoordinatesFromGoogleEmbedUrl(
  googleMapsUrl?: string | null
): HotelCoordinates | null {
  if (!googleMapsUrl) return null;

  const latMatch = googleMapsUrl.match(/!3d(-?\d+\.?\d*)/);
  const lngMatch = googleMapsUrl.match(/!2d(-?\d+\.?\d*)/);
  if (!latMatch || !lngMatch) return null;

  const lat = Number.parseFloat(latMatch[1]);
  const lng = Number.parseFloat(lngMatch[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  return { lat, lng };
}

export function resolveHotelCoordinates(hotel: {
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  googleMapsUrl?: string | null;
}): HotelCoordinates | null {
  if (hotel.latitude != null && hotel.longitude != null) {
    return { lat: hotel.latitude, lng: hotel.longitude };
  }

  return HOTEL_COORDINATES[hotel.name] ?? parseCoordinatesFromGoogleEmbedUrl(hotel.googleMapsUrl);
}

export function toHotelMapPin(hotel: {
  id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  googleMapsUrl?: string | null;
  logoImageUrl?: string | null;
  coverImageUrl?: string | null;
}): HotelMapPin | null {
  const coordinates = resolveHotelCoordinates(hotel);
  if (!coordinates) return null;

  return {
    id: hotel.id,
    name: hotel.name,
    lat: coordinates.lat,
    lng: coordinates.lng,
    logoImageUrl: hotel.logoImageUrl ?? null,
    coverImageUrl: hotel.coverImageUrl ?? null,
  };
}

export function buildGoogleDirectionsUrl(
  latitude: number,
  longitude: number,
  googleMapsUrl?: string | null
) {
  if (googleMapsUrl?.startsWith("http")) {
    return googleMapsUrl.replace("/maps/embed?", "/maps/place?").replace("embed?", "place?");
  }

  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
