import { describe, it, expect } from "vitest";
import type { EmailBrand } from "@/lib/email/hotel-brand";
import { absoluteUrl, hotelSiteUrl, isUsableBrandColor, mixColor } from "@/lib/email/hotel-brand";
import { withFromName } from "@/lib/email/send";
import {
  buildAdminBookingCanceledEmail,
  buildBookingCanceledEmail,
  buildBookingConfirmedEmail,
  buildBookingProcessingEmail,
  countNights,
  countdownLine,
  type BookingWithListing,
} from "@/lib/email/templates/booking";

const brand: EmailBrand = {
  hotelName: "La Arbolita",
  siteUrl: "https://laarbolita.mx",
  logoUrl: "https://laarbolita.mx/images/hotels/la-arbolita/logo-square.png",
  color: "#024d3c",
  colorDark: "#023327",
  colorSoft: "#e6edeb",
  tagline: "Estudios y casas del árbol",
  location: "Zicatela",
  contactPhone: "+52 961 555 8958",
  mapsUrl: "https://maps.google.com/?q=La+Arbolita",
  roomPhotos: ["https://img/1.jpg", "https://img/2.jpg", "https://img/3.jpg"],
  roomDescription: "Un rinconcito entre los árboles <con> aire acondicionado.",
  roomCapacity: 2,
};

const booking = {
  id: "bk_1",
  listingId: "l1",
  guestEmail: "guest@example.com",
  guestPhone: "+529541234567",
  guestName: "Ana López",
  guestCount: 2,
  startDate: new Date("2026-12-01T00:00:00Z"),
  endDate: new Date("2026-12-03T00:00:00Z"),
  totalPriceCents: 307300,
  currency: "MXN",
  listing: { id: "l1", hotelId: "h1", title: "Forest Studio 3" },
} as unknown as BookingWithListing;

describe("branded booking emails", () => {
  it("brands the processing email with the hotel logo, photos and links", () => {
    const { subject, html, text } = buildBookingProcessingEmail(booking, brand);
    expect(subject).toBe("Recibimos tu reserva en La Arbolita · Forest Studio 3");
    expect(html).toContain(brand.logoUrl);
    expect(html).toContain("background:#024d3c");
    for (const photo of brand.roomPhotos) expect(html).toContain(photo);
    expect(html).toContain("https://laarbolita.mx/booking/bk_1");
    expect(html).toContain("https://wa.me/529615558958");
    expect(html).toContain("¡Ya casi, Ana!");
    expect(html).toContain("&lt;con&gt;");
    expect(text).toContain("2 noches");
  });

  it("confirms with the charged total and stay highlights", () => {
    const { subject, html } = buildBookingConfirmedEmail(booking, brand);
    expect(subject).toContain("Reserva confirmada en La Arbolita");
    expect(html).toContain("Total pagado");
    expect(html).toMatch(/3,073\.00/);
  });

  it("skips the photo gallery on cancellations and links back to the hotel site", () => {
    const { html } = buildBookingCanceledEmail(booking, "Dates taken", brand);
    expect(html).not.toContain("https://img/2.jpg");
    expect(html).toContain('href="https://laarbolita.mx"');
    expect(html).toContain("Dates taken");
    expect(buildAdminBookingCanceledEmail(booking, "Dates taken", brand).text).toContain("guest@example.com");
  });

  it("counts nights from UTC dates", () => {
    expect(countNights(booking)).toBe(2);
  });
});

describe("email brand helpers", () => {
  it("uses the hotel's custom domain for links and relative assets", () => {
    expect(hotelSiteUrl("laarbolita.mx")).toBe("https://laarbolita.mx");
    expect(absoluteUrl("/images/x.png", "https://laarbolita.mx")).toBe("https://laarbolita.mx/images/x.png");
    expect(absoluteUrl("https://cdn/x.png", "https://a")).toBe("https://cdn/x.png");
    expect(absoluteUrl("data:text/html,x", "https://a")).toBeNull();
  });

  it("rejects white, black and gray logo colors", () => {
    expect(isUsableBrandColor(2, 77, 60)).toBe(true);
    expect(isUsableBrandColor(250, 250, 250)).toBe(false);
    expect(isUsableBrandColor(10, 10, 10)).toBe(false);
    expect(isUsableBrandColor(128, 128, 130)).toBe(false);
    expect(mixColor("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("sends from the hotel name with the configured address", () => {
    expect(withFromName("Aldeitas Reservas <reservas@aldeitas.io>", "La Arbolita")).toBe(
      '"La Arbolita" <reservas@aldeitas.io>'
    );
    expect(withFromName("reservas@aldeitas.io", 'Bad"\r\nName')).toBe('"BadName" <reservas@aldeitas.io>');
    expect(withFromName("reservas@aldeitas.io")).toBe("reservas@aldeitas.io");
  });

  it("counts down to arrival and links directions, mobile-first", () => {
    expect(countdownLine(booking, new Date("2026-11-01T18:00:00Z"))).toBe("Faltan 30 días para tu llegada 🌴");
    expect(countdownLine(booking, new Date("2026-11-30T05:00:00Z"))).toBe("¡Llegas mañana! 🌴");
    expect(countdownLine(booking, new Date("2026-12-02T00:00:00Z"))).toBeNull();
    const { html } = buildBookingConfirmedEmail(booking, brand);
    expect(html).toContain("https://maps.google.com/?q=La+Arbolita");
    expect(html).toContain('name="viewport"');
    expect(html).toContain("@media only screen and (max-width: 520px)");
  });
});
