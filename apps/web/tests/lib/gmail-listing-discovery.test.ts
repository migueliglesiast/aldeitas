import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { extractAirbnbRoomIds } from "@/lib/gmail-listing-discovery";
import { scrapeListingDescription, scrapeListingTitle } from "@/lib/airbnb";

describe("extractAirbnbRoomIds", () => {
  it("reads listing ids from quoted-printable hrefs, deduplicated", () => {
    const source = [
      '<a href=3D"https://www.airbnb.com/rooms/1053572195=',
      '213481575?source=3Demail">Treehouse</a>',
      "https://www.airbnb.mx/rooms/1053572195213481575",
      "https://www.airbnb.com/rooms/1041526793864468718",
    ].join("\r\n");
    expect(extractAirbnbRoomIds(source)).toEqual(["1053572195213481575", "1041526793864468718"]);
  });

  it("ignores non-Airbnb room links", () => {
    expect(extractAirbnbRoomIds("https://example.com/rooms/123456789")).toEqual([]);
  });
});

describe("scrapeListingTitle", () => {
  it("keeps the listing name from the page title", () => {
    const html =
      "<title>Oceanview 3-tier tower, block from beach &amp; market! - Treehouses for Rent in Brisas de Zicatela, Oaxaca, Mexico - Airbnb</title>";
    expect(scrapeListingTitle(html)).toBe("Oceanview 3-tier tower, block from beach & market!");
  });

  it("returns null for removed listings", () => {
    expect(scrapeListingTitle("<title>404 Page Not Found - Airbnb</title>")).toBeNull();
  });
});

describe("listing structured data", () => {
  const html =
    '<title>Other - Airbnb</title><script type="application/ld+json">' +
    JSON.stringify({ "@type": "VacationRental", name: "Oceanview tower", description: "Awaken to the sound of waves." }) +
    "</script>";

  it("prefers the VacationRental name and description", () => {
    expect(scrapeListingTitle(html)).toBe("Oceanview tower");
    expect(scrapeListingDescription(html)).toBe("Awaken to the sound of waves.");
  });
});
