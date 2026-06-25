"use client";

import { useEffect, useState } from "react";
import { useStorefront } from "@/lib/storefront-context";

/** Desired parallax speed on short pages (background moves 30% as fast as scroll). */
const MAX_PARALLAX_FACTOR = 0.3;
/** Extra image above the viewport (matches previous top: -30%). */
const HEADROOM_RATIO = 0.3;
/** Extra image below the viewport at scroll 0 (180% height − 30% head − 100% viewport). */
const TAILROOM_RATIO = 0.5;

type ParallaxState = {
  offset: number;
  factor: number;
};

function measureParallax(): ParallaxState {
  const viewportHeight = window.innerHeight;
  const maxScroll = Math.max(
    0,
    document.documentElement.scrollHeight - viewportHeight
  );
  const tailroom = viewportHeight * TAILROOM_RATIO;
  const factor =
    maxScroll > 0
      ? Math.min(MAX_PARALLAX_FACTOR, tailroom / maxScroll)
      : MAX_PARALLAX_FACTOR;

  return {
    offset: window.scrollY * factor,
    factor,
  };
}

export default function ParallaxBackground() {
  const storefront = useStorefront();
  const [offset, setOffset] = useState(0);
  const backgroundImage = storefront?.parallaxImageUrl
    ? `url('${storefront.parallaxImageUrl}')`
    : "url('/images/background_image.png')";

  useEffect(() => {
    const update = () => setOffset(measureParallax().offset);

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });

    const observer = new ResizeObserver(update);
    observer.observe(document.documentElement);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        top: `${-HEADROOM_RATIO * 100}%`,
        height: `${(HEADROOM_RATIO + 1 + TAILROOM_RATIO) * 100}%`,
        zIndex: -1,
        pointerEvents: "none",
        transform: `translateY(${-offset}px)`,
        backgroundImage,
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#000",
      }}
    />
  );
}
