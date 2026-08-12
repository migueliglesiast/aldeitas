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
        top: "-30%",
        height: "180%",
        zIndex: -1,
        pointerEvents: "none",
        transform: `translateY(${-offset}px)`,
        backgroundImage:
          "radial-gradient(1200px 500px at 15% 0%, rgba(255, 56, 92, 0.06), transparent 60%), radial-gradient(1000px 450px at 85% 10%, rgba(255, 180, 0, 0.05), transparent 60%), linear-gradient(to bottom, #ffffff 0%, #f7f7f7 100%)",
        backgroundColor: "#ffffff",
      }}
    />
  );
}

