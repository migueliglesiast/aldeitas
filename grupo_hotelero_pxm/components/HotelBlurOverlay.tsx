"use client";
import { useHotel } from "@/lib/hotel-context";
import { useState, useEffect } from "react";

export default function HotelBlurOverlay() {
  const { selectedHotelImage } = useHotel();
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (selectedHotelImage) {
      setImageLoaded(false);
      const img = new Image();
      img.onload = () => setImageLoaded(true);
      img.onerror = () => setImageLoaded(false);
      img.src = selectedHotelImage;
    } else {
      setImageLoaded(false);
    }
  }, [selectedHotelImage]);

  if (!selectedHotelImage) {
    return null;
  }

  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none transition-opacity duration-1000 ease-in-out"
      style={{
        zIndex: 0, // Between ParallaxBackground (-1) and content (default)
        opacity: imageLoaded ? 0.4 : 0, // Slightly increased opacity since it's less dark now
      }}
    >
      {/* Blurred background image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${selectedHotelImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          filter: "blur(30px) brightness(0.95) saturate(1.0)", // Reduced blur, brighter, natural saturation
          transform: "scale(1.05)", // Reduced scale since blur is less
        }}
      />
    </div>
  );
}

