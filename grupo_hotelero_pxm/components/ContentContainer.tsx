"use client";
import { useHotel } from "@/lib/hotel-context";
import { useState, useEffect, ReactNode } from "react";

export default function ContentContainer({ children }: { children: ReactNode }) {
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 md:py-6 rounded-lg mt-[1vh] md:mt-[2vh] relative overflow-hidden">
      {/* Blurred background layer */}
      {selectedHotelImage && imageLoaded && (
        <div
          className="absolute inset-0 rounded-lg transition-opacity duration-1000 ease-in-out"
          style={{
            backgroundImage: `url(${selectedHotelImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            filter: "blur(30px) brightness(0.95) saturate(1.0)",
            transform: "scale(1.05)",
            zIndex: 0,
            opacity: 0.4,
          }}
        />
      )}
      
      {/* Overlay that blends with original background color */}
      <div
        className="absolute inset-0 rounded-lg backdrop-blur-sm transition-all duration-1000 ease-in-out"
        style={{
          backgroundColor: selectedHotelImage && imageLoaded 
            ? "rgba(195, 208, 205, 0.0125)" 
            : "rgba(195, 208, 205, 0.02)",
          zIndex: 1,
        }}
      />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

