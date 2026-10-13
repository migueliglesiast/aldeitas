import type { HostThread, WhatsappConversation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { InboundMessage } from "@/lib/whatsapp/cloud-api";
import { TEMPLATES, asLocale, t } from "@/lib/whatsapp/copy";
import { minutesFromEnv } from "@/lib/whatsapp/config";
import { hostPhoneForHotel, inServiceWindow, sendToPhone } from "@/lib/whatsapp/messaging";
import { canonicalPhone } from "@/lib/whatsapp/phone";

async function guestLabel(conversation: WhatsappConversation) {
  const [hotel, listing, booking] = await Promise.all([
    conversation.hotelId ? prisma.hotel.findUnique({ where: { id: conversation.hotelId } }) : null,
    conversation.listingId ? prisma.listing.findUnique({ where: { id: conversation.listingId } }) : null,
    conversation.bookingId ? prisma.booking.findUnique({ where: { id: conversation.bookingId } }) : null,
  ]);
  const guest = booking?.guestName ? `${booking.guestName} (+${conversation.phone})` : `+${conversation.phone}`;
  return { hotel: hotel?.name ?? "Aldeitas", room: listing?.title ?? null, guest };
}

/** Sends a guest question (QUESTION) or a forwarded guest message (RELAY) to the hotel's host. */
export async function askHost(conversation: WhatsappConversation, question: string, kind: "QUESTION" | "RELAY" = "QUESTION") {
  const hostPhone = await hostPhoneForHotel(conversation.hotelId);
  if (!hostPhone) {
    console.error("[whatsapp] no host phone for hotel %s", conversation.hotelId);
    return null;
  }
  const label = await guestLabel(conversation);
  const where = label.room ? `${label.hotel} · ${label.room}` : label.hotel;
  const text =
    kind === "QUESTION"
      ? `Pregunta de huésped · ${where} · ${label.guest}:\n"${question}"\n\nResponde deslizando este mensaje y se lo paso. Escribe "yo me encargo" para atenderlo tú.`
      : `Mensaje de huésped · ${where} · ${label.guest}:\n"${question}"\n\nResponde deslizando este mensaje y se lo paso.`;
  const waId = await sendToPhone(hostPhone, text, {
    template: { name: TEMPLATES.hostQuestion, language: "es_MX", params: [where, label.guest, question] },
  });
  return prisma.hostThread.create({
    data: { conversationId: conversation.id, hostPhone, kind, question, hostWaMessageId: waId },
  });
}

const PAUSE = /^(yo me encargo|me encargo|yo lo atiendo|i'?ll handle it)\b/i;
const RESUME = /^(listo bot|bot|regresa bot|resume bot)\s*$/i;

async function resolveThread(hostPhone: string, contextId: string | null): Promise<HostThread | "none" | "ambiguous"> {
  if (contextId) {
    const quoted = await prisma.hostThread.findUnique({ where: { hostWaMessageId: contextId } });
    if (quoted) return quoted;
  }
  const open = await prisma.hostThread.findMany({
    where: { hostPhone, status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 2,
  });
  if (open.length === 1) return open[0];
  return open.length === 0 ? "none" : "ambiguous";
}

export async function handleHostMessage(fromPhone: string, message: InboundMessage) {
  const hostPhone = canonicalPhone(fromPhone);
  const button = message.buttonId?.match(/^(save|once):(.+)$/);
  if (button) {
    const thread = await prisma.hostThread.findUnique({ where: { id: button[2] }, include: { conversation: true } });
    if (thread?.answer && button[1] === "save" && thread.conversation.hotelId) {
      await prisma.guestAnswer.create({
        data: { hotelId: thread.conversation.hotelId, question: thread.question, answer: thread.answer },
      });
      await sendToPhone(hostPhone, "Guardado. La próxima vez respondo yo. Puedes editarlo en /admin.");
    } else {
      await sendToPhone(hostPhone, "Listo, no lo guardé.");
    }
    return;
  }

  const thread = await resolveThread(hostPhone, message.contextId);
  if (thread === "none") {
    await sendToPhone(hostPhone, "No tengo preguntas pendientes de huéspedes. Para responder a una, desliza su mensaje.");
    return;
  }
  if (thread === "ambiguous") {
    await sendToPhone(hostPhone, "Tienes varias preguntas pendientes. Desliza el mensaje del huésped al que respondes.");
    return;
  }
  const conversation = await prisma.whatsappConversation.findUniqueOrThrow({ where: { id: thread.conversationId } });

  if (PAUSE.test(message.text.trim())) {
    await prisma.whatsappConversation.update({ where: { id: conversation.id }, data: { botPaused: true } });
    await prisma.hostThread.update({ where: { id: thread.id }, data: { status: "OPEN", kind: "RELAY" } });
    await sendToPhone(hostPhone, `Listo, ya no respondo a +${conversation.phone}. Te reenvío sus mensajes; responde deslizándolos. Escribe "listo bot" para que vuelva a atender.`);
    return;
  }
  if (RESUME.test(message.text.trim())) {
    await prisma.whatsappConversation.update({ where: { id: conversation.id }, data: { botPaused: false } });
    await prisma.hostThread.updateMany({ where: { conversationId: conversation.id, status: "OPEN" }, data: { status: "CLOSED" } });
    await sendToPhone(hostPhone, `Listo, vuelvo a atender a +${conversation.phone}.`);
    return;
  }

  if (!inServiceWindow(conversation.lastInboundAt)) {
    await sendToPhone(hostPhone, "El huésped no ha escrito en las últimas 24 horas, así que WhatsApp no me deja enviarle texto libre. Escríbele cuando vuelva a escribir.");
    return;
  }
  const locale = asLocale(conversation.locale);
  const body = thread.kind === "QUESTION" ? `${t("hostAnswerPrefix", locale)}${message.text}` : message.text;
  await sendToPhone(conversation.phone, body, { author: "host" });

  if (thread.kind === "QUESTION") {
    await prisma.hostThread.update({
      where: { id: thread.id },
      data: { status: "ANSWERED", answer: message.text, answeredAt: new Date() },
    });
    await sendToPhone(hostPhone, "Se lo envié. ¿Lo guardo para responder solo la próxima vez?", {
      buttons: [
        { id: `save:${thread.id}`, title: "Guardar" },
        { id: `once:${thread.id}`, title: "Solo esta vez" },
      ],
    });
  }
}

export async function remindStaleHostQuestions(now = new Date()) {
  const minutes = minutesFromEnv("WHATSAPP_HOST_REMINDER_MINUTES", 30);
  const stale = await prisma.hostThread.findMany({
    where: {
      kind: "QUESTION",
      status: "OPEN",
      remindedAt: null,
      createdAt: { lt: new Date(now.getTime() - minutes * 60 * 1000) },
    },
    include: { conversation: true },
  });
  for (const thread of stale) {
    const label = await guestLabel(thread.conversation);
    const waId = await sendToPhone(thread.hostPhone, `Recordatorio: el huésped ${label.guest} sigue esperando respuesta:\n"${thread.question}"\n\nResponde deslizando este mensaje.`, {
      template: { name: TEMPLATES.hostQuestion, language: "es_MX", params: [label.hotel, label.guest, thread.question] },
    }).catch(() => null);
    await prisma.hostThread.update({
      where: { id: thread.id },
      data: { remindedAt: now, ...(waId ? { hostWaMessageId: waId } : {}) },
    });
  }
  return stale.length;
}
