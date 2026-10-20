import type { EmergencyDispatch, WhatsappConversation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TEMPLATES, asLocale, emergencyKind, t, templateLanguage } from "@/lib/whatsapp/copy";
import { minutesFromEnv } from "@/lib/whatsapp/config";
import { hostPhoneForHotel, sendToPhone } from "@/lib/whatsapp/messaging";
import { canonicalPhone } from "@/lib/whatsapp/phone";
import { rankedProviders, type EmergencyService } from "@/lib/whatsapp/providers-sheet";

const OPEN = ["DISPATCHING", "ACCEPTED"];
const SERVICE_LABEL: Record<EmergencyService, string> = { plumbing: "Plomería", electrical: "Eléctrico" };

async function placeLabel(conversation: WhatsappConversation) {
  const [hotel, listing] = await Promise.all([
    conversation.hotelId ? prisma.hotel.findUnique({ where: { id: conversation.hotelId } }) : null,
    conversation.listingId ? prisma.listing.findUnique({ where: { id: conversation.listingId } }) : null,
  ]);
  return {
    hotel: hotel?.name ?? "Hotel sin identificar",
    room: listing?.title ?? "habitación sin identificar",
    map: hotel?.googleMapsUrl ?? hotel?.location ?? "",
  };
}

async function notifyHost(conversation: WhatsappConversation, text: string) {
  const host = await hostPhoneForHotel(conversation.hotelId);
  if (!host) return;
  await sendToPhone(host, text, {
    template: { name: TEMPLATES.hostQuestion, language: "es_MX", params: ["Aldeitas", `+${conversation.phone}`, text] },
  }).catch((error) => console.error("[whatsapp] host emergency notice failed", error));
}

async function alertNextProvider(dispatch: EmergencyDispatch, conversation: WhatsappConversation) {
  const providers = await rankedProviders(dispatch.service as EmergencyService);
  const locale = asLocale(conversation.locale);
  const next = providers[dispatch.attempt];
  if (!next) {
    await prisma.emergencyDispatch.update({ where: { id: dispatch.id }, data: { status: "ESCALATED", providerId: null } });
    await sendToPhone(conversation.phone, t("emergencyNoProvider", locale));
    await notifyHost(conversation, `URGENTE: nadie aceptó la emergencia (${SERVICE_LABEL[dispatch.service as EmergencyService]}): "${dispatch.description}". Huésped +${conversation.phone}. Encárgate directamente.`);
    return;
  }
  const place = await placeLabel(conversation);
  const text = `Emergencia ${SERVICE_LABEL[dispatch.service as EmergencyService]} en ${place.hotel} (${place.room}): ${dispatch.description}. Ubicación: ${place.map}. ¿Puedes ir?`;
  await prisma.emergencyDispatch.update({
    where: { id: dispatch.id },
    data: { providerId: next.id, attempt: dispatch.attempt + 1, lastAlertAt: new Date() },
  });
  await sendToPhone(next.phone, text, {
    buttons: [
      { id: `em:accept:${dispatch.id}`, title: "Voy en camino" },
      { id: `em:decline:${dispatch.id}`, title: "No puedo" },
    ],
    template: {
      name: TEMPLATES.emergency,
      language: "es_MX",
      params: [SERVICE_LABEL[dispatch.service as EmergencyService], place.hotel, place.room, dispatch.description, place.map],
      buttonPayloads: [`em:accept:${dispatch.id}`, `em:decline:${dispatch.id}`],
    },
  }).catch(async (error) => {
    console.error("[whatsapp] provider alert failed; trying next", error);
    const fresh = await prisma.emergencyDispatch.findUniqueOrThrow({ where: { id: dispatch.id } });
    await alertNextProvider(fresh, conversation);
  });
}

export async function startEmergency(conversation: WhatsappConversation, service: EmergencyService, description: string) {
  const locale = asLocale(conversation.locale);
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const existing = await prisma.emergencyDispatch.findFirst({
    where: { conversationId: conversation.id, service, status: { in: OPEN }, createdAt: { gte: since } },
  });
  if (existing) {
    await sendToPhone(conversation.phone, t("emergencyAck", locale, { kind: emergencyKind(service, locale) }));
    return existing;
  }
  const dispatch = await prisma.emergencyDispatch.create({
    data: { conversationId: conversation.id, service, description },
  });
  await sendToPhone(conversation.phone, t("emergencyAck", locale, { kind: emergencyKind(service, locale) }));
  const place = await placeLabel(conversation);
  await notifyHost(conversation, `Emergencia (${SERVICE_LABEL[service]}) en ${place.hotel}, ${place.room}: "${description}". Ya estoy contactando proveedores en orden; te aviso.`);
  await alertNextProvider(dispatch, conversation);
  return dispatch;
}

/** Handles a provider's "Voy en camino" / "No puedo" (button or plain sí/no). Returns false if the message wasn't a provider reply. */
export async function handleProviderReply(phone: string, text: string, buttonId: string | null) {
  let dispatch: EmergencyDispatch | null = null;
  let accept: boolean | null = null;
  const button = buttonId?.match(/^em:(accept|decline):(.+)$/);
  if (button) {
    dispatch = await prisma.emergencyDispatch.findUnique({ where: { id: button[2] } });
    accept = button[1] === "accept";
  } else {
    const key = canonicalPhone(phone);
    const providers = await prisma.serviceProvider.findMany({ where: { phone: key } });
    if (providers.length === 0) return false;
    dispatch = await prisma.emergencyDispatch.findFirst({
      where: { status: "DISPATCHING", providerId: { in: providers.map((p) => p.id) } },
      orderBy: { lastAlertAt: "desc" },
    });
    const normalized = text.trim().toLowerCase();
    if (/^(s[ií]|voy|ok|va|claro|en camino)/.test(normalized)) accept = true;
    else if (/^(no|no puedo|imposible)/.test(normalized)) accept = false;
  }
  if (!dispatch || accept === null) return Boolean(button);
  if (dispatch.status !== "DISPATCHING") return true;

  const provider = dispatch.providerId
    ? await prisma.serviceProvider.findUnique({ where: { id: dispatch.providerId } })
    : null;
  if (!provider || canonicalPhone(provider.phone) !== canonicalPhone(phone)) return true;

  const conversation = await prisma.whatsappConversation.findUniqueOrThrow({ where: { id: dispatch.conversationId } });
  if (accept) {
    await prisma.emergencyDispatch.update({ where: { id: dispatch.id }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
    await sendToPhone(conversation.phone, t("emergencyOnTheWay", asLocale(conversation.locale), { provider: provider.name }));
    await sendToPhone(provider.phone, `Gracias ${provider.name}. El huésped es +${conversation.phone}.`);
    await notifyHost(conversation, `${provider.name} aceptó la emergencia y va en camino ("${dispatch.description}").`);
  } else {
    await alertNextProvider(dispatch, conversation);
  }
  return true;
}

export async function advanceTimedOutEmergencies(now = new Date()) {
  const timeout = minutesFromEnv("WHATSAPP_EMERGENCY_TIMEOUT_MINUTES", 10);
  const stale = await prisma.emergencyDispatch.findMany({
    where: { status: "DISPATCHING", lastAlertAt: { lt: new Date(now.getTime() - timeout * 60 * 1000) } },
    include: { conversation: true },
  });
  for (const dispatch of stale) {
    await alertNextProvider(dispatch, dispatch.conversation);
  }
  return stale.length;
}
