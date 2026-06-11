"use client";
import { useMemo, useState, useRef, useEffect, memo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import ImageWithPlaceholder from "@/components/ImageWithPlaceholder";
import { useHotel } from "@/lib/hotel-context";
import HotelBrandHeader, { useHotelBrandPalette } from "@/components/HotelBrandHeader";
import { paletteToCssVars } from "@/lib/hotel-branding";
import { toHotelMapPin, type HotelMapPin } from "@/lib/hotel-map";
import { useLocale } from "@/lib/i18n/locale-context";
import MapLoadingPlaceholder from "@/components/MapLoadingPlaceholder";
import LocalizedDescription from "@/components/LocalizedDescription";
import { formatMoneyShort } from "@/lib/currency";

const HotelAreaMap = dynamic(() => import("@/components/HotelAreaMap"), {
  ssr: false,
  loading: () => <MapLoadingPlaceholder />,
});

type ImageType = { id: string; url: string; position: number };
type Listing = { id: string; title: string; nightlyBasePrice: number; baseCurrency: string; images: ImageType[] };
type Hotel = { 
  id: string; 
  name: string; 
  description: string;
  descriptionEn?: string | null;
  descriptionEs?: string | null;
  location: string;
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  coverImageUrl?: string | null;
  logoImageUrl?: string | null;
  images?: ImageType[];
  listings: Listing[] 
};

export default function HotelGrid({ hotels }: { hotels: Hotel[] }) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [expandedHotelId, setExpandedHotelId] = useState<string | null>(null);
  const expandedRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const { setSelectedHotelImage, searchParams, hotelAvailability } = useHotel();

  const filtered = useMemo(() => {
    let result = hotels;
    
    // Filter by search query if present
    if (query) {
      const q = query.toLowerCase();
      result = result.filter((h) => `${h.name} ${h.location}`.toLowerCase().includes(q));
    }
    
    // Filter by availability if search params exist
    if (searchParams && hotelAvailability) {
      result = result.filter((h) => {
        const availableCount = hotelAvailability[h.id] || 0;
        return availableCount > 0; // Only show hotels with at least one available room
      });
    }
    
    return result;
  }, [hotels, query, searchParams, hotelAvailability]);

  // Keep hotels in original order to prevent remounting - use CSS order instead
  const mapPins = useMemo(
    () => hotels.map((hotel) => toHotelMapPin(hotel)).filter(Boolean) as HotelMapPin[],
    [hotels]
  );

  const organizedHotels = useMemo(() => {
    return filtered;
  }, [filtered]);

  // Set selected hotel image for blur overlay
  useEffect(() => {
    if (expandedHotelId) {
      const expandedHotel = hotels.find(h => h.id === expandedHotelId);
      if (expandedHotel) {
        const slug = slugify(expandedHotel.name);
        const candidates = [
          `/images/hotels/${slug}/cover.jpg`,
          `/images/hotels/${slug}/cover.jpeg`,
          `/images/hotels/${slug}/cover.png`,
          `/images/hotels/${slug}/cover.webp`,
        ];
        // Use the first candidate as the blur source
        setSelectedHotelImage(candidates[0]);
      }
    } else {
      setSelectedHotelImage(null);
    }
  }, [expandedHotelId, hotels]);

  // Scroll to expanded hotel with smooth animation after a brief delay
  useEffect(() => {
    if (expandedHotelId && expandedRef.current) {
      setIsAnimating(true);
      // Wait for layout to settle before scrolling - use requestAnimationFrame for smoother experience
      const timer = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          expandedRef.current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest', // Use 'nearest' instead of 'start' to avoid jumping
            inline: 'nearest'
          });
          setTimeout(() => setIsAnimating(false), 400);
        });
      });
      return () => cancelAnimationFrame(timer);
    } else {
      setIsAnimating(false);
    }
  }, [expandedHotelId]);

  function slugify(name: string) {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getHotelImages(hotel: Hotel): string[] {
    const withoutLogo = (urls: string[]) =>
      hotel.logoImageUrl ? urls.filter((url) => url !== hotel.logoImageUrl) : urls;

    const dbImages = withoutLogo(hotel.images?.map((image) => image.url) ?? []);
    if (dbImages.length > 0) return dbImages;

    const slug = slugify(hotel.name);
    const images: string[] = [];

    if (hotel.coverImageUrl && hotel.coverImageUrl !== hotel.logoImageUrl) {
      images.push(hotel.coverImageUrl);
    }

    const coverPath = `/images/hotels/${slug}/cover.jpg`;
    if (coverPath !== hotel.logoImageUrl) {
      images.push(coverPath);
    }

    return images;
  }

  const HotelCard = memo(function HotelCard({
    h,
    isExpanded,
    expandedHotelId,
    mapPins,
    t,
  }: {
    h: Hotel;
    isExpanded: boolean;
    expandedHotelId: string | null;
    mapPins: HotelMapPin[];
    t: ReturnType<typeof useLocale>["t"];
  }) {
    const [coverIndex, setCoverIndex] = useState(0);
    const [carouselIndex, setCarouselIndex] = useState(0);
    const slug = slugify(h.name);
    const brandPalette = useHotelBrandPalette(isExpanded ? h.logoImageUrl : null);
    const brandStyle = paletteToCssVars(brandPalette);
    
    const candidates = [
      `/images/hotels/${slug}/cover.jpg`,
      `/images/hotels/${slug}/cover.jpeg`,
      `/images/hotels/${slug}/cover.png`,
      `/images/hotels/${slug}/cover.webp`,
    ];
    const usingCover = coverIndex < candidates.length;
    const coverSrc = usingCover ? candidates[coverIndex] : undefined;
    const displaySrc = usingCover ? coverSrc : undefined;
    const totalRooms = h.listings?.length ?? 0;
    
    // Get available room count if search is active
    const availableRooms = (searchParams && hotelAvailability) 
      ? (hotelAvailability[h.id] || 0)
      : null;
    
    // Use available rooms count if search is active, otherwise use total rooms
    const rooms = availableRooms !== null ? availableRooms : totalRooms;
    const minPrice = h.listings?.length ? Math.min(...h.listings.map((l) => l.nightlyBasePrice)) : null;
    
    const galleryImages = getHotelImages(h);
    const isDimmed = Boolean(expandedHotelId) && !isExpanded;

    return (
      <div
        ref={isExpanded ? expandedRef : null}
        className={`transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isExpanded ? "col-span-full" : ""
        } ${isAnimating && isExpanded ? "transform-gpu" : ""}`}
        style={{
          transitionProperty: 'all',
          willChange: isExpanded ? 'transform, opacity' : 'auto',
          order: isExpanded ? -1 : 0
        }}
      >
        {!isExpanded ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              setExpandedHotelId(h.id);
            }}
            className={[
              "group rounded-lg border text-left w-full overflow-hidden bg-white",
              "transition-all duration-500 ease-out hover:shadow-lg",
              isDimmed
                ? "border-slate-300/80 grayscale-[78%] sepia-[28%] brightness-[0.94] opacity-80 hover:grayscale-0 hover:sepia-0 hover:brightness-100 hover:opacity-100 hover:border-[#00a19c]/35"
                : "border-gray-200 hover:border-[#00a19c]/30",
            ].join(" ")}
          >
            <div className="relative h-44 w-full overflow-hidden rounded-t">
              {displaySrc ? (
                <ImageWithPlaceholder
                  src={displaySrc}
                  alt={h.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform group-hover:scale-105"
                  onError={() => {
                    if (usingCover) {
                      setCoverIndex((i) => i + 1);
                    }
                  }}
                />
              ) : (
                <div className="relative h-full w-full bg-gray-100">
                  <div className="absolute inset-0 flex items-center justify-center opacity-20">
                    <Image
                      src="/images/aldeitas_logo.png"
                      alt="Aldeitas logo"
                      width={120}
                      height={120}
                      className="object-contain"
                      priority={false}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{h.name}</p>
                {minPrice !== null && (
                  <p className="text-sm text-gray-500">
                    {t("fromPrice", { price: formatMoneyShort(minPrice) })}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <p>{h.location}</p>
                {availableRooms !== null ? (
                  <p>
                    {t("roomsAvailable", {
                      count: rooms,
                      roomsLabel: rooms === 1 ? t("room") : t("rooms"),
                    })}
                  </p>
                ) : (
                  <p>
                    {rooms} {rooms === 1 ? t("room") : t("rooms")}
                  </p>
                )}
              </div>
            </div>
          </button>
        ) : (
          <div
            className="rounded-lg border-2 p-6 space-y-4 shadow-xl animate-fade-in-scale backdrop-blur-md transition-colors duration-500"
            style={{
              ...brandStyle,
              borderColor: "var(--hotel-brand-ring)",
              backgroundColor: "color-mix(in srgb, white 88%, var(--hotel-brand-muted))",
              boxShadow: `0 20px 50px -28px var(--hotel-brand-primary)`,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <HotelBrandHeader
                name={h.name}
                location={h.location}
                logoImageUrl={h.logoImageUrl}
                className="flex-1"
              />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setExpandedHotelId(null);
                  setSelectedHotelImage(null);
                }}
                className="text-gray-400 hover:text-gray-700 text-3xl leading-none transition-all duration-200 hover:scale-110 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/70 shrink-0"
                aria-label={t("close")}
              >
                ×
              </button>
            </div>

            {/* Map and Carousel Row — mobile: carousel then map; desktop: overlapping layout */}
            <div className="relative flex w-full flex-col overflow-hidden rounded-lg md:block md:min-h-[450px]">
              {/* Carousel — first on mobile, right overlay on desktop */}
              <div className="relative order-1 h-56 w-full shrink-0 sm:h-72 md:absolute md:right-0 md:top-0 md:z-0 md:h-full md:w-[65%]">
                <div className="relative ml-auto h-full w-full">
                  {galleryImages.length > 0 ? (
                    <div className="relative h-full w-full overflow-hidden rounded-lg">
                      <div className="absolute inset-0 [mask-image:none] [-webkit-mask-image:none] md:[mask-image:linear-gradient(to_right,transparent_0%,black_8%,black_100%)] md:[-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_8%,black_100%)]">
                        <ImageWithPlaceholder
                          src={galleryImages[carouselIndex] || galleryImages[0]}
                          alt={`${h.name} - Image ${carouselIndex + 1}`}
                          fill
                          sizes="(max-width: 768px) 100vw, 65vw"
                          className="object-cover"
                          onError={() => {
                            setCarouselIndex(0);
                          }}
                        />
                      </div>

                      {galleryImages.length > 1 && (
                        <>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCarouselIndex(
                                (prev) => (prev - 1 + galleryImages.length) % galleryImages.length
                              );
                            }}
                            className="absolute bottom-4 left-1/2 z-30 flex h-10 w-10 -translate-x-[52px] items-center justify-center rounded-full border border-white/30 bg-white/20 text-white shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-white/30 hover:shadow-xl md:bottom-6 md:h-12 md:w-12 md:-translate-x-[60px]"
                            aria-label={t("previousImage")}
                          >
                            <span className="text-2xl font-light">‹</span>
                          </button>

                          <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-sm md:bottom-6">
                            {galleryImages.map((_, idx) => (
                              <button
                                key={idx}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setCarouselIndex(idx);
                                }}
                                className={`h-2 w-2 rounded-full transition-all ${
                                  idx === carouselIndex
                                    ? "w-6 bg-white"
                                    : "bg-white/60 hover:bg-white/80"
                                }`}
                                aria-label={t("goToImage", { n: idx + 1 })}
                              />
                            ))}
                          </div>

                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCarouselIndex((prev) => (prev + 1) % galleryImages.length);
                            }}
                            className="absolute bottom-4 left-1/2 z-30 flex h-10 w-10 translate-x-[12px] items-center justify-center rounded-full border border-white/30 bg-white/20 text-white shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-white/30 hover:shadow-xl md:bottom-6 md:h-12 md:w-12 md:translate-x-[60px]"
                            aria-label={t("nextImage")}
                          >
                            <span className="text-2xl font-light">›</span>
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-lg bg-gray-100 text-gray-400">
                      {t("noImages")}
                    </div>
                  )}
                </div>
              </div>

              {/* Map — second on mobile, left overlay on desktop */}
              <div className="relative order-2 h-52 w-full shrink-0 sm:h-60 md:absolute md:left-0 md:top-0 md:z-10 md:h-full md:w-[38%]">
                <div className="relative h-full w-full overflow-hidden rounded-lg md:overflow-visible md:rounded-l-lg">
                  <div className="absolute inset-0 overflow-hidden rounded-lg [mask-image:none] [-webkit-mask-image:none] md:rounded-l-lg md:[mask-image:linear-gradient(to_right,black_0%,black_87%,transparent_100%)] md:[-webkit-mask-image:linear-gradient(to_right,black_0%,black_87%,transparent_100%)]">
                    <HotelAreaMap
                      hotels={mapPins}
                      selectedHotelId={h.id}
                      className="rounded-lg md:rounded-l-lg"
                    />
                  </div>
                </div>
              </div>
            </div>

            <LocalizedDescription
              item={h}
              className="pt-4 text-sm leading-relaxed md:text-base"
            />

            {/* See Rooms and Availability Button */}
            <div className="pt-4 flex justify-start">
              <Link
                href={`/hotel/${h.id}`}
                className="inline-flex items-center gap-2 rounded-lg px-8 py-3 text-white font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg"
                style={{
                  backgroundColor: "var(--hotel-brand-primary)",
                  boxShadow: `0 12px 24px -16px var(--hotel-brand-primary)`,
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.backgroundColor = "var(--hotel-brand-accent)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor = "var(--hotel-brand-primary)";
                }}
              >
                {t("seeRooms")}
                <span className="text-lg">→</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]" style={{ display: 'grid' }}>
        {organizedHotels.map((h) => (
          <HotelCard key={h.id} h={h} isExpanded={expandedHotelId === h.id} expandedHotelId={expandedHotelId} mapPins={mapPins} t={t} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-gray-500 py-8">
            {t("noResults")}
          </div>
        )}
      </div>
    </div>
  );
}
