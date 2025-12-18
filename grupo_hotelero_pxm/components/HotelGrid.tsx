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
  listings: Listing[] 
};

export default function HotelGrid({ hotels }: { hotels: Hotel[] }) {
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
    const slug = slugify(hotel.name);
    const images: string[] = [];
    
    // Priority 1: Use coverImageUrl from database (can be Google Drive URL)
    if ((hotel as any).coverImageUrl) {
      images.push((hotel as any).coverImageUrl);
    }
    
    // Priority 2: Fallback to local public folder
    images.push(`/images/hotels/${slug}/cover.jpg`);
    
    return images;
  }

  const HotelCard = memo(function HotelCard({ h, isExpanded, expandedHotelId }: { h: Hotel; isExpanded: boolean; expandedHotelId: string | null }) {
    const [coverIndex, setCoverIndex] = useState(0);
    const [carouselIndex, setCarouselIndex] = useState(0);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const slug = slugify(h.name);
    
    // Get the map embed URL directly from the database - memoize to prevent recalculation
    const mapEmbedUrl = useMemo(() => {
      const rawUrl = (h as any).googleMapsUrl || h.googleMapsUrl;
      return rawUrl && String(rawUrl).trim() !== "" ? String(rawUrl).trim() : null;
    }, [h.googleMapsUrl, h.id]);
    
    // Set iframe src only once when it first becomes visible
    const iframeKey = `map-${h.id}`;
    const [iframeSrc, setIframeSrc] = useState<string | undefined>(undefined);
    
    useEffect(() => {
      if (isExpanded && mapEmbedUrl && !iframeSrc) {
        // Only set src once when expanded
        setIframeSrc(mapEmbedUrl);
      } else if (!isExpanded) {
        // Don't clear src when collapsed to prevent reload
        // setIframeSrc(undefined);
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
    
    // Get available room count if search is active
    const availableRooms = (searchParams && hotelAvailability) 
      ? (hotelAvailability[h.id] || 0)
      : null;
    
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
            className="group rounded-lg border border-gray-200 hover:border-[#00a19c]/30 hover:shadow-lg text-left w-full transition-all duration-300 ease-out bg-white overflow-hidden"
          >
            <div className="relative h-44 w-full overflow-hidden rounded-t">
              {displaySrc ? (
                <Image
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
                {minPrice !== null && <p className="text-sm text-gray-500">from ${(minPrice / 100).toFixed(0)}</p>}
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <p>{h.location}</p>
                {availableRooms !== null ? (
                  <p>
                    <span className="font-bold text-[#00a19c]">{rooms}</span> room{rooms === 1 ? "" : "s"} available
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
          <div className="rounded-lg border-2 border-[#00a19c]/20 p-6 space-y-4 shadow-xl animate-fade-in-scale backdrop-blur-md" style={{ backgroundColor: 'rgba(255, 255, 255, 0.6)' }}>
            {/* Title at top left */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl md:text-3xl font-semibold text-[#00a19c]">{h.name}</h2>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setExpandedHotelId(null);
                  setSelectedHotelImage(null);
                }}
                className="text-gray-400 hover:text-gray-700 text-3xl leading-none transition-all duration-200 hover:scale-110 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Map and Carousel Row */}
            <div className="relative w-full overflow-hidden rounded-lg" style={{ minHeight: "450px" }}>
              {/* Carousel Container - Right 65% (behind map) */}
              <div className="absolute right-0 top-0 w-[65%] h-full z-0">
                <div className="relative w-full h-full ml-auto">
                  {galleryImages.length > 0 ? (
                    <>
                      <div className="relative w-full h-full overflow-hidden rounded-lg">
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
                    <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400 rounded-lg">
                      No images available
                    </div>
                  )}
                </div>
              </div>

              {/* Map Container - Left 38% with transparency fade over carousel (covers ~5% of carousel) */}
              <div className="absolute left-0 top-0 w-[38%] h-full z-10">
                <div className="relative w-full h-full rounded-l-lg overflow-visible">
                  <div 
                    className="absolute inset-0 rounded-l-lg overflow-hidden"
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
                        className="rounded-l-lg"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm">
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
                    className="absolute bottom-6 left-1/2 -translate-x-[60px] bg-white/20 backdrop-blur-sm hover:bg-white/30 border border-white/30 text-white rounded-full w-12 h-12 flex items-center justify-center z-30 transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-xl"
                    aria-label="Previous image"
                  >
                    <span className="text-2xl font-light">‹</span>
                  </button>
                  
                  {/* Image indicator dots - centered */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-30 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
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
                    className="absolute bottom-6 left-1/2 translate-x-[60px] bg-white/20 backdrop-blur-sm hover:bg-white/30 border border-white/30 text-white rounded-full w-12 h-12 flex items-center justify-center z-30 transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-xl"
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
                className="inline-flex items-center gap-2 rounded-lg bg-[#00a19c] px-8 py-3 text-white font-medium hover:bg-[#008a86] transition-all duration-200 hover:scale-105 hover:shadow-lg"
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]" style={{ display: 'grid' }}>
        {organizedHotels.map((h) => (
          <HotelCard key={h.id} h={h} isExpanded={expandedHotelId === h.id} expandedHotelId={expandedHotelId} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-gray-500 py-8">
            No results found. Try adjusting your search.
          </div>
        )}
      </div>
    </div>
  );
}
