import type { WhatsappConversation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  sendWhatsappButtons,
  sendWhatsappTemplate,
  sendWhatsappText,
  type ReplyButton,
  type TemplateMessage,
} from "@/lib/whatsapp/cloud-api";
import { SERVICE_WINDOW_MS } from "@/lib/whatsapp/config";
import { canonicalPhone } from "@/lib/whatsapp/phone";

export function inServiceWindow(lastInboundAt: Date | null | undefined, now = new Date()) {
  return Boolean(lastInboundAt && now.getTime() - lastInboundAt.getTime() < SERVICE_WINDOW_MS);
}

export function getOrCreateConversation(phone: string, data: Partial<Pick<WhatsappConversation, "hotelId" | "listingId" | "bookingId" | "locale">> = {}) {
  const key = canonicalPhone(phone);
  return prisma.whatsappConversation.upsert({
    where: { phone: key },
    create: { phone: key, ...data },
    update: data,
  });
}

export function recordMessage(
  conversationId: string,
  direction: "in" | "out",
  author: "guest" | "bot" | "host" | "provider",
  body: string,
  waMessageId?: string | null
) {
  return prisma.whatsappMessage.create({
    data: { conversationId, direction, author, body, waMessageId: waMessageId ?? null },
  });
}

type SendOptions = {
  template?: TemplateMessage;
  author?: "bot" | "host";
  buttons?: ReplyButton[];
  replyToId?: string;
};

/**
 * Sends free text inside WhatsApp's 24h customer-service window, otherwise the approved template.
 * Returns the WhatsApp message id, or null when nothing could be sent.
 */
export async function sendToPhone(phone: string, text: string, options: SendOptions = {}) {
  const conversation = await getOrCreateConversation(phone);
  let waId: string | null = null;
  if (inServiceWindow(conversation.lastInboundAt)) {
    waId = options.buttons?.length
      ? await sendWhatsappButtons(conversation.phone, text, options.buttons)
      : await sendWhatsappText(conversation.phone, text, options.replyToId);
  } else if (options.template) {
    waId = await sendWhatsappTemplate(conversation.phone, options.template);
  } else {
    console.warn("[whatsapp] 24h window closed and no template for %s", conversation.phone);
    return null;
  }
  await recordMessage(conversation.id, "out", options.author ?? "bot", text, waId);
  return waId;
}

export async function hostPhoneForHotel(hotelId: string | null | undefined) {
  if (hotelId) {
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { mainContactNumber: true } });
    if (hotel?.mainContactNumber) return canonicalPhone(hotel.mainContactNumber);
  }
  const fallback = process.env.WHATSAPP_DEFAULT_HOST_PHONE;
  return fallback ? canonicalPhone(fallback) : null;
}

export async function isHostPhone(phone: string) {
  const key = canonicalPhone(phone);
  const fallback = process.env.WHATSAPP_DEFAULT_HOST_PHONE;
  if (fallback && canonicalPhone(fallback) === key) return true;
  const hotels = await prisma.hotel.findMany({
    where: { mainContactNumber: { not: null } },
    select: { mainContactNumber: true },
  });
  return hotels.some((h) => h.mainContactNumber && canonicalPhone(h.mainContactNumber) === key);
}
