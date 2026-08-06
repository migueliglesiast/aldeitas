"use client";
import { useMemo, useState, useRef, useEffect, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useHotel } from "@/lib/hotel-context";

type ImageType = { id: string; url: string; position: number };
type Listing = { id: string; title: string; nightlyBasePrice: number; baseCurrency: string; images: ImageType[] };
type Hotel = {
  id: string;
  name: string;
  description: string;
  location: string;
  googleMapsUrl?: string | null;
  coverImageUrl?: string | null;
  listings: Listing[]
};

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
  const slug = slugify(hotel.name);
  const images: string[] = [];

  // Priority 1: Use coverImageUrl from database (can be Google Drive URL)
  if (hotel.coverImageUrl) {
    images.push(hotel.coverImageUrl);
  }

  // Priority 2: Fallback to local public folder
  images.push(`/images/hotels/${slug}/cover.jpg`);

  return images;
}

type HotelCardProps = {
  h: Hotel;
  isExpanded: boolean;
  isAnimating: boolean;
  expandedRef: React.RefObject<HTMLDivElement | null>;
  availableRooms: number | null;
  setExpandedHotelId: (id: string | null) => void;
  setSelectedHotelImage: (src: string | null) => void;
};

export default function HotelGrid({ hotels }: { hotels: Hotel[] }) {
  const [query, setQuery] = useState("");
  const [showMap, setShowMap] = useState(false);
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
  const organizedHotels = useMemo(() => {
    return filtered;
  }, [filtered]);

  const mapHotels = useMemo(
    () => filtered.filter((h) => h.googleMapsUrl && String(h.googleMapsUrl).trim() !== ""),
    [filtered]
  );
  const [mapHotelId, setMapHotelId] = useState<string | null>(null);
  const activeMapHotel = mapHotels.find((h) => h.id === mapHotelId) ?? mapHotels[0] ?? null;

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name or location"
          aria-label="Filter hotels by name or location"
          className="w-full max-w-xs rounded-full border border-line px-4 py-2 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShowMap((v) => !v)}
          aria-pressed={showMap}
          className="inline-flex items-center gap-2 self-start rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.03] sm:self-auto"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          {showMap ? "Hide map" : "Show map"}
        </button>
      </div>

      {showMap ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {mapHotels.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setMapHotelId(h.id)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                  activeMapHotel?.id === h.id
                    ? "border-ink bg-surface"
                    : "border-line hover:border-ink/40"
                }`}
              >
                <span>
                  <span className="block font-semibold text-ink">{h.name}</span>
                  <span className="block text-sm text-muted">{h.location}</span>
                </span>
                {h.listings?.length > 0 && (
                  <span className="shrink-0 text-sm font-semibold text-ink">
                    from ${(Math.min(...h.listings.map((l) => l.nightlyBasePrice)) / 100).toFixed(0)}
                  </span>
                )}
              </button>
            ))}
            {mapHotels.length === 0 && (
              <p className="text-muted">No hotels with map locations match your filters.</p>
            )}
          </div>
          <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-line lg:sticky lg:top-40 lg:h-[calc(100vh-220px)]">
            {activeMapHotel ? (
              <iframe
                title={`Map of ${activeMapHotel.name}`}
                src={String(activeMapHotel.googleMapsUrl)}
                width="100%"
                height="100%"
                style={{ border: 0, position: "absolute", inset: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted">
                Map unavailable
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]" style={{ display: 'grid' }}>
          {organizedHotels.map((h) => (
            <HotelCard
              key={h.id}
              h={h}
              isExpanded={expandedHotelId === h.id}
              isAnimating={isAnimating}
              expandedRef={expandedRef}
              availableRooms={searchParams && hotelAvailability ? (hotelAvailability[h.id] || 0) : null}
              setExpandedHotelId={setExpandedHotelId}
              setSelectedHotelImage={setSelectedHotelImage}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-muted py-8">
              No results found. Try adjusting your search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const HotelCard = memo(function HotelCard({
  h,
  isExpanded,
  isAnimating,
  expandedRef,
  availableRooms,
  setExpandedHotelId,
  setSelectedHotelImage,
}: HotelCardProps) {
    const [coverIndex, setCoverIndex] = useState(0);
    const [carouselIndex, setCarouselIndex] = useState(0);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const slug = slugify(h.name);

    // Get the map embed URL directly from the database - memoize to prevent recalculation
    const mapEmbedUrl = useMemo(() => {
      const rawUrl = h.googleMapsUrl;
      return rawUrl && String(rawUrl).trim() !== "" ? String(rawUrl).trim() : null;
    }, [h.googleMapsUrl, h.id]);

    // Set iframe src only once when it first becomes visible
    const iframeKey = `map-${h.id}`;
    const [iframeSrc, setIframeSrc] = useState<string | undefined>(undefined);

    useEffect(() => {
      if (isExpanded && mapEmbedUrl && !iframeSrc) {
        // Only set src once when expanded
        setIframeSrc(mapEmbedUrl);
      }
    }, [isExpanded, mapEmbedUrl, iframeSrc]);
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

    // Use available rooms count if search is active, otherwise use total rooms
    const rooms = availableRooms !== null ? availableRooms : totalRooms;
    const minPrice = h.listings?.length ? Math.min(...h.listings.map((l) => l.nightlyBasePrice)) : null;

    const galleryImages = getHotelImages(h);

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
            className="group w-full text-left"
          >
            <div className="relative aspect-[20/13] w-full overflow-hidden rounded-2xl bg-surface">
              {displaySrc ? (
                <Image
                  src={displaySrc}
                  alt={h.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  onError={() => {
                    if (usingCover) {
                      setCoverIndex((i) => i + 1);
                    }
                  }}
                />
              ) : (
                <div className="relative h-full w-full bg-surface">
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
            <div className="mt-3 space-y-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate font-semibold text-ink">{h.name}</p>
                {minPrice !== null && (
                  <p className="shrink-0 text-sm text-ink">
                    <span className="font-semibold">from ${(minPrice / 100).toFixed(0)}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between text-sm text-muted">
                <p>{h.location}</p>
                {availableRooms !== null ? (
                  <p>
                    <span className="font-bold text-brand">{rooms}</span> room{rooms === 1 ? "" : "s"} available
                  </p>
                ) : (
                  <p>
                    {rooms} room{rooms === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            </div>
          </button>
        ) : (
          <div className="rounded-3xl border border-line/70 bg-white/80 p-6 space-y-4 shadow-card animate-fade-in-scale backdrop-blur-md">
            {/* Title at top left */}
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl md:text-3xl font-bold text-ink">{h.name}</h2>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setExpandedHotelId(null);
                  setSelectedHotelImage(null);
                }}
                className="text-muted hover:text-ink text-3xl leading-none transition-all duration-200 hover:scale-110 w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Map and Carousel Row */}
            <div className="relative w-full overflow-hidden rounded-2xl" style={{ minHeight: "450px" }}>
              {/* Carousel Container - Right 65% (behind map) */}
              <div className="absolute right-0 top-0 w-[65%] h-full z-0">
                <div className="relative w-full h-full ml-auto">
                  {galleryImages.length > 0 ? (
                    <>
                      <div className="relative w-full h-full overflow-hidden rounded-2xl">
                        <div
                          className="absolute inset-0"
                          style={{
                            maskImage: "linear-gradient(to right, transparent 0%, black 8%, black 100%)",
                            WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 8%, black 100%)"
                          }}
                        >
                          <Image
                            src={galleryImages[carouselIndex] || galleryImages[0]}
                            alt={`${h.name} - Image ${carouselIndex + 1}`}
                            fill
                            sizes="65vw"
                            className="object-cover transition-opacity duration-300"
                            onError={() => {
                              setCarouselIndex(0);
                            }}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-surface text-muted rounded-2xl">
                      No images available
                    </div>
                  )}
                </div>
              </div>

              {/* Map Container - Left 38% with transparency fade over carousel (covers ~5% of carousel) */}
              <div className="absolute left-0 top-0 w-[38%] h-full z-10">
                <div className="relative w-full h-full rounded-l-2xl overflow-visible">
                  <div
                    className="absolute inset-0 rounded-l-2xl overflow-hidden"
                    style={{
                      maskImage: "linear-gradient(to right, black 0%, black 87%, transparent 100%)",
                      WebkitMaskImage: "linear-gradient(to right, black 0%, black 87%, transparent 100%)"
                    }}
                  >
                    {mapEmbedUrl ? (
                      <iframe
                        ref={iframeRef}
                        key={iframeKey}
                        src={iframeSrc}
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        className="rounded-l-2xl"
                      />
                    ) : (
                      <div className="w-full h-full bg-surface flex items-center justify-center text-muted text-sm">
                        Map URL not available
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Navigation arrows centered in the row, overlaid on top */}
              {galleryImages.length > 1 && (
                <>
                  {/* Left arrow - centered in the row */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCarouselIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
                    }}
                    className="absolute bottom-6 left-1/2 -translate-x-[60px] bg-white/90 hover:bg-white text-ink rounded-full w-11 h-11 flex items-center justify-center z-30 transition-all duration-300 hover:scale-110 shadow-pill"
                    aria-label="Previous image"
                  >
                    <span className="text-2xl font-light">‹</span>
                  </button>

                  {/* Image indicator dots - centered */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-30 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    {galleryImages.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCarouselIndex(idx);
                        }}
                        className={`w-2 h-2 rounded-full transition-all ${
                          idx === carouselIndex ? "bg-white w-6" : "bg-white/60 hover:bg-white/80"
                        }`}
                        aria-label={`Go to image ${idx + 1}`}
                      />
                    ))}
                  </div>

                  {/* Right arrow - centered in the row */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCarouselIndex((prev) => (prev + 1) % galleryImages.length);
                    }}
                    className="absolute bottom-6 left-1/2 translate-x-[60px] bg-white/90 hover:bg-white text-ink rounded-full w-11 h-11 flex items-center justify-center z-30 transition-all duration-300 hover:scale-110 shadow-pill"
                    aria-label="Next image"
                  >
                    <span className="text-2xl font-light">›</span>
                  </button>
                </>
              )}
            </div>

            {/* See Rooms and Availability Button */}
            <div className="pt-4 flex justify-start">
              <Link
                href={`/hotel/${h.id}`}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-8 py-3 text-white font-semibold hover:bg-brand-dark transition-all duration-200 hover:scale-[1.02] hover:shadow-card"
              >
                See Rooms and Availability
                <span className="text-lg">→</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  });
