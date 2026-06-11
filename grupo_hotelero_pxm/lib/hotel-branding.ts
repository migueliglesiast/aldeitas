import type { CSSProperties } from "react";

export type HotelBrandPalette = {
  primary: string;
  accent: string;
  muted: string;
  ring: string;
};

export const DEFAULT_HOTEL_PALETTE: HotelBrandPalette = {
  primary: "#00a19c",
  accent: "#008a86",
  muted: "rgba(0, 161, 156, 0.1)",
  ring: "rgba(0, 161, 156, 0.18)",
};

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function loadImage(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:\/\//i.test(imageUrl)) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${imageUrl}`));
    img.src = imageUrl;
  });
}

/** Average color along the image edges — works well for logos on solid backgrounds. */
export async function extractLogoEdgeBackground(imageUrl: string): Promise<string> {
  if (typeof window === "undefined") {
    return "#ffffff";
  }

  try {
    const img = await loadImage(imageUrl);
    const canvas = document.createElement("canvas");
    const width = Math.min(img.naturalWidth, 160);
    const height = Math.min(img.naturalHeight, 160);
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return "#ffffff";

    ctx.drawImage(img, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);

    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;

    const sample = (x: number, y: number) => {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      if (alpha < 160) return;
      r += data[index];
      g += data[index + 1];
      b += data[index + 2];
      count += 1;
    };

    for (let x = 0; x < width; x += 1) {
      sample(x, 0);
      sample(x, height - 1);
    }
    for (let y = 1; y < height - 1; y += 1) {
      sample(0, y);
      sample(width - 1, y);
    }

    if (count === 0) return "#ffffff";

    return rgbToHex(
      Math.round(r / count),
      Math.round(g / count),
      Math.round(b / count)
    );
  } catch {
    return "#ffffff";
  }
}

function mixHex(base: string, target: string, amount: number) {
  const parse = (hex: string) => {
    const normalized = hex.replace("#", "");
    return [
      parseInt(normalized.slice(0, 2), 16),
      parseInt(normalized.slice(2, 4), 16),
      parseInt(normalized.slice(4, 6), 16),
    ];
  };

  const [br, bg, bb] = parse(base);
  const [tr, tg, tb] = parse(target);
  const mix = (from: number, to: number) => Math.round(from + (to - from) * amount);

  return rgbToHex(mix(br, tr), mix(bg, tg), mix(bb, tb));
}

function isUsableColor(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2 / 255;
  const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));

  return lightness > 0.12 && lightness < 0.82 && saturation > 0.12;
}

export async function extractBrandPalette(imageUrl: string): Promise<HotelBrandPalette> {
  if (typeof window === "undefined") {
    return DEFAULT_HOTEL_PALETTE;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 48;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(DEFAULT_HOTEL_PALETTE);
          return;
        }

        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();

        for (let i = 0; i < data.length; i += 16) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 180 || !isUsableColor(r, g, b)) continue;

          const key = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}`;
          const bucket = buckets.get(key);
          if (bucket) {
            bucket.count += 1;
            bucket.r += r;
            bucket.g += g;
            bucket.b += b;
          } else {
            buckets.set(key, { count: 1, r, g, b });
          }
        }

        const dominant = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
        if (!dominant) {
          resolve(DEFAULT_HOTEL_PALETTE);
          return;
        }

        const r = Math.round(dominant.r / dominant.count);
        const g = Math.round(dominant.g / dominant.count);
        const b = Math.round(dominant.b / dominant.count);
        const primary = rgbToHex(r, g, b);
        const accent = mixHex(primary, "#1f2937", 0.22);
        const muted = `rgba(${r}, ${g}, ${b}, 0.1)`;
        const ring = `rgba(${r}, ${g}, ${b}, 0.18)`;

        resolve({ primary, accent, muted, ring });
      } catch {
        resolve(DEFAULT_HOTEL_PALETTE);
      }
    };

    img.onerror = () => resolve(DEFAULT_HOTEL_PALETTE);
    img.src = imageUrl;
  });
}

export function paletteToCssVars(palette: HotelBrandPalette) {
  return {
    "--hotel-brand-primary": palette.primary,
    "--hotel-brand-accent": palette.accent,
    "--hotel-brand-muted": palette.muted,
    "--hotel-brand-ring": palette.ring,
  } as CSSProperties;
}
