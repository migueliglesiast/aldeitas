"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { HOTEL_AREA_BOUNDS, type HotelMapPin } from "@/lib/hotel-map";
import { extractLogoEdgeBackground } from "@/lib/hotel-branding";

type Props = {
  hotels: HotelMapPin[];
  selectedHotelId: string;
  className?: string;
};

function escapeAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pinImageUrl(hotel: HotelMapPin) {
  return hotel.logoImageUrl || hotel.coverImageUrl || null;
}

function createPinIcon(
  hotel: HotelMapPin,
  selected: boolean,
  backgroundColor = "#ffffff"
) {
  const size = selected ? 28 : 18;
  const radius = selected ? 8 : 5;
  const outline = selected
    ? "1px solid rgba(0, 161, 156, 0.45)"
    : "1px solid rgba(0, 161, 156, 0.18)";
  const shadow = selected
    ? "0 8px 18px -8px rgba(0, 161, 156, 0.55)"
    : "0 4px 10px -6px rgba(0, 0, 0, 0.18)";
  const imageUrl = pinImageUrl(hotel);
  const initial = hotel.name.trim().charAt(0).toUpperCase() || "?";

  const inner = imageUrl
    ? `<img src="${escapeAttr(imageUrl)}" alt="" style="display:block;width:100%;height:100%;object-fit:contain;object-position:center;" />`
    : `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;"><span style="font-size:${selected ? 11 : 9}px;font-weight:700;line-height:1;color:#008a86;">${escapeAttr(initial)}</span></div>`;

  return `
    <div style="
      width:${size}px;
      height:${size}px;
      border-radius:${radius}px;
      background:${escapeAttr(backgroundColor)};
      outline:${outline};
      box-shadow:${shadow};
      transform: translate(-50%, -50%);
      overflow:hidden;
    ">${inner}</div>
  `;
}

export default function HotelAreaMap({ hotels, selectedHotelId, className = "" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [logoBackgrounds, setLogoBackgrounds] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadBackgrounds() {
      const entries = await Promise.all(
        hotels.map(async (hotel) => {
          const imageUrl = pinImageUrl(hotel);
          if (!imageUrl) return [hotel.id, "#ffffff"] as const;
          const color = await extractLogoEdgeBackground(imageUrl);
          return [hotel.id, color] as const;
        })
      );

      if (cancelled) return;
      setLogoBackgrounds(Object.fromEntries(entries));
    }

    loadBackgrounds();

    return () => {
      cancelled = true;
    };
  }, [hotels]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    map.fitBounds(
      [
        [HOTEL_AREA_BOUNDS.southWest.lat, HOTEL_AREA_BOUNDS.southWest.lng],
        [HOTEL_AREA_BOUNDS.northEast.lat, HOTEL_AREA_BOUNDS.northEast.lng],
      ],
      { padding: [18, 18] }
    );

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const nextIds = new Set(hotels.map((hotel) => hotel.id));

    for (const [id, marker] of markersRef.current.entries()) {
      if (!nextIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    for (const hotel of hotels) {
      const selected = hotel.id === selectedHotelId;
      const icon = L.divIcon({
        className: "hotel-area-map-pin",
        html: createPinIcon(hotel, selected, logoBackgrounds[hotel.id] ?? "#ffffff"),
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const existing = markersRef.current.get(hotel.id);
      if (existing) {
        existing.setLatLng([hotel.lat, hotel.lng]);
        existing.setIcon(icon);
        existing.setZIndexOffset(selected ? 1000 : 0);
        continue;
      }

      const marker = L.marker([hotel.lat, hotel.lng], {
        icon,
        zIndexOffset: selected ? 1000 : 0,
      })
        .bindTooltip(hotel.name, {
          direction: "top",
          offset: [0, -16],
          opacity: 0.95,
        })
        .addTo(map);

      markersRef.current.set(hotel.id, marker);
    }
  }, [hotels, selectedHotelId, logoBackgrounds]);

  if (hotels.length === 0) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-[#e8f6f5] to-[#faf3e8] text-sm text-[#4a7c78] ${className}`}
      >
        Map not available
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <div ref={containerRef} className="hotel-area-map absolute inset-0 z-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-[#dff3f2]/20 via-transparent to-[#f7edd8]/15"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 hidden bg-gradient-to-r from-transparent via-transparent to-white/20 md:block"
      />
    </div>
  );
}
