import axios from "axios";
import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import { saveUploadedImage } from "../lib/image-storage";

const POST_URL = process.argv[2] || "https://www.instagram.com/p/DZB2HT4DhBK/";
const HOTEL_NAME = process.argv[3] || "La Arbolita";

function getShortcode(postUrl: string) {
  const match = postUrl.match(/\/p\/([^/?#]+)/);
  if (!match?.[1]) {
    throw new Error(`Could not parse Instagram shortcode from ${postUrl}`);
  }
  return match[1];
}

function unescapeInstagramHtml(value: string) {
  let out = value;
  for (let i = 0; i < 6; i += 1) {
    out = out.replace(/\\\//g, "/");
  }
  return out.replace(/\\"/g, '"').replace(/&amp;/g, "&");
}

function extractCarouselImageUrls(html: string): string[] {
  const marker = "edge_sidecar_to_children";
  const start = html.indexOf(marker);
  if (start < 0) {
    const ogMatch = html.match(/property="og:image" content="([^"]+)"/);
    const ogUrl = ogMatch?.[1] ? unescapeInstagramHtml(ogMatch[1]) : null;
    return ogUrl ? [ogUrl] : [];
  }

  const end = html.indexOf(marker, start + marker.length);
  const chunk = unescapeInstagramHtml(
    end > start ? html.slice(start, end) : html.slice(start, start + 250000)
  );

  const displayUrls = [
    ...chunk.matchAll(/display_url":"(https:\/\/scontent[^"]+?)"/g),
  ].map((match) => match[1]);

  const fallbackUrls = [...chunk.matchAll(/https:\/\/scontent[^"'\\]+?\/\d+_\d+_\d+_n\.jpg[^"'\\]*/g)].map(
    (match) => match[0]
  );

  const urls = displayUrls.length > 0 ? displayUrls : fallbackUrls;
  const unique = [...new Map(urls.map((url) => [url.split("?")[0], url])).values()];
  const carousel = unique.filter(
    (url) => /\/v\/t51\.82787-15\//.test(url) && /_1796391\d+_/.test(url)
  );

  return carousel.length > 0 ? carousel : unique.filter((url) => /\/v\/t51\.82787-15\//.test(url)).slice(0, 6);
}

async function downloadImage(url: string, hotelId: string, index: number) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      referer: "https://www.instagram.com/",
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
    timeout: 30000,
  });

  const contentType = String(response.headers["content-type"] || "image/jpeg");
  const extension = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";

  return saveUploadedImage(Buffer.from(response.data), {
    folder: "hotels",
    filenameBase: `hotel-${hotelId}-ig-${Date.now()}-${index}-${randomBytes(3).toString("hex")}`,
    extension,
  });
}

async function main() {
  const shortcode = getShortcode(POST_URL);
  const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/`;

  console.log(`Fetching ${embedUrl} ...`);
  const { data: html } = await axios.get(embedUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
    timeout: 30000,
  });

  const htmlText = String(html);
  const imageUrls = extractCarouselImageUrls(htmlText);
  console.log(`Found ${imageUrls.length} carousel image(s)`);
  if (imageUrls.length === 0) {
    throw new Error("No carousel images found in Instagram embed HTML");
  }

  const prisma = new PrismaClient();
  try {
    const hotel = await prisma.hotel.findFirst({
      where: { name: HOTEL_NAME },
      include: { images: { orderBy: { position: "desc" }, take: 1 } },
    });
    if (!hotel) {
      throw new Error(`Hotel "${HOTEL_NAME}" not found`);
    }

    let nextPosition = (hotel.images[0]?.position ?? -1) + 1;

    for (const [index, sourceUrl] of imageUrls.entries()) {
      console.log(`Downloading ${index + 1}/${imageUrls.length} ...`);
      const localUrl = await downloadImage(sourceUrl, hotel.id, index + 1);
      const image = await prisma.hotelImage.create({
        data: {
          hotelId: hotel.id,
          url: localUrl,
          position: nextPosition,
        },
      });
      console.log(`✓ Added ${localUrl} (id: ${image.id})`);
      nextPosition += 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
