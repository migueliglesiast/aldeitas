import { prisma } from "@/lib/prisma";
import { TEMPLATES, asLocale, t, templateLanguage } from "@/lib/whatsapp/copy";
import { getOrCreateConversation, sendToPhone } from "@/lib/whatsapp/messaging";
import { formatStayDate } from "@/lib/whatsapp/stay";

const TZ = "America/Mexico_City";
const DAY_MS = 24 * 60 * 60 * 1000;

export function localDateAndHour(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

const include = { listing: { include: { hotel: true } } } as const;

export async function runStayMessages(now = new Date()) {
  const { date: today, hour } = localDateAndHour(now);
  const tomorrow = isoDay(new Date(Date.parse(`${today}T00:00:00Z`) + DAY_MS));
  const checkinHour = Number(process.env.WHATSAPP_CHECKIN_INFO_HOUR) || 10;
  const goodbyeHour = Number(process.env.WHATSAPP_GOODBYE_HOUR) || 12;
  const sent = { welcome: 0, checkin: 0, goodbye: 0 };

  const welcomes = await prisma.booking.findMany({
    where: { status: "CONFIRMED", welcomeSentAt: null, confirmedAt: { gte: new Date(now.getTime() - 2 * DAY_MS) }, endDate: { gt: now } },
    include,
  });
  for (const booking of welcomes) {
    if (!booking.guestPhone) continue;
    const conversation = await getOrCreateConversation(booking.guestPhone, {
      bookingId: booking.id,
      hotelId: booking.listing.hotelId,
      listingId: booking.listingId,
    });
    await prisma.whatsappConversation.update({ where: { id: conversation.id }, data: { endedAt: null, botPaused: false } });
    const locale = asLocale(conversation.locale);
    const vars = {
      name: booking.guestName?.split(" ")[0] ?? "",
      hotel: booking.listing.hotel.name,
      checkIn: formatStayDate(booking.startDate, locale),
      checkOut: formatStayDate(booking.endDate, locale),
    };
    try {
      await sendToPhone(conversation.phone, t("welcome", locale, vars), {
        template: { name: TEMPLATES.welcome, language: templateLanguage(locale), params: [vars.name || "!", vars.hotel, vars.checkIn, vars.checkOut] },
      });
      await prisma.booking.update({ where: { id: booking.id }, data: { welcomeSentAt: now } });
      sent.welcome += 1;
    } catch (error) {
      console.error("[whatsapp] welcome failed for booking %s", booking.id, error);
    }
  }

  if (hour >= checkinHour) {
    const arrivals = await prisma.booking.findMany({
      where: { status: "CONFIRMED", checkinInfoSentAt: null, startDate: { gte: new Date(`${tomorrow}T00:00:00Z`), lt: new Date(Date.parse(`${tomorrow}T00:00:00Z`) + DAY_MS) } },
      include,
    });
    for (const booking of arrivals) {
      if (!booking.guestPhone) continue;
      const conversation = await getOrCreateConversation(booking.guestPhone, { bookingId: booking.id, hotelId: booking.listing.hotelId, listingId: booking.listingId });
      const locale = asLocale(conversation.locale);
      const hotel = booking.listing.hotel;
      const map = hotel.googleMapsUrl ? `${locale === "en" ? "Map" : "Mapa"}: ${hotel.googleMapsUrl}. ` : "";
      try {
        await sendToPhone(conversation.phone, t("checkinInfo", locale, { hotel: hotel.name, location: hotel.location, map }), {
          template: { name: TEMPLATES.checkin, language: templateLanguage(locale), params: [hotel.name, hotel.location, hotel.googleMapsUrl ?? hotel.location] },
        });
        await prisma.booking.update({ where: { id: booking.id }, data: { checkinInfoSentAt: now } });
        sent.checkin += 1;
      } catch (error) {
        console.error("[whatsapp] check-in info failed for booking %s", booking.id, error);
      }
    }
  }

  if (hour >= goodbyeHour) {
    const departures = await prisma.booking.findMany({
      where: { status: "CONFIRMED", goodbyeSentAt: null, endDate: { gte: new Date(`${today}T00:00:00Z`), lt: new Date(Date.parse(`${today}T00:00:00Z`) + DAY_MS) } },
      include,
    });
    for (const booking of departures) {
      if (!booking.guestPhone) continue;
      const conversation = await getOrCreateConversation(booking.guestPhone);
      const locale = asLocale(conversation.locale);
      const hotel = booking.listing.hotel.name;
      try {
        await sendToPhone(conversation.phone, t("goodbye", locale, { hotel }), {
          template: { name: TEMPLATES.goodbye, language: templateLanguage(locale), params: [hotel] },
        });
        await prisma.booking.update({ where: { id: booking.id }, data: { goodbyeSentAt: now } });
        if (conversation.bookingId === booking.id) {
          await prisma.whatsappConversation.update({ where: { id: conversation.id }, data: { endedAt: now } });
        }
        sent.goodbye += 1;
      } catch (error) {
        console.error("[whatsapp] goodbye failed for booking %s", booking.id, error);
      }
    }
  }

  return sent;
}
