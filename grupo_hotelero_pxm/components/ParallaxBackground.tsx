"use client";
import { useEffect, useState } from "react";

export default function ParallaxBackground() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setOffset(window.scrollY * 0.3); // move slower than scroll
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        top: "-35%",          // extra top to allow translating without gaps
        height: "220%",        // taller than viewport to avoid bottom whitespace
        zIndex: -1,
        pointerEvents: "none",
        transform: `translateY(${-offset}px)`,
        backgroundImage: "url('/images/background.jpeg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#000",
      }}
    />
  );
}

