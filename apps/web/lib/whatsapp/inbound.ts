import { prisma } from "@/lib/prisma";
import { detectEmergencyByKeywords, runAgent, type AgentDecision } from "@/lib/whatsapp/agent";
import { answersFor, bestKeywordMatch } from "@/lib/whatsapp/answers";
import type { InboundMessage } from "@/lib/whatsapp/cloud-api";
import { isAgentLlmConfigured } from "@/lib/whatsapp/config";
import { asLocale, detectLocale, t } from "@/lib/whatsapp/copy";
import { handleProviderReply, startEmergency } from "@/lib/whatsapp/emergency";
import { askHost, handleHostMessage } from "@/lib/whatsapp/host-relay";
import { getOrCreateConversation, isHostPhone, recordMessage, sendToPhone } from "@/lib/whatsapp/messaging";
import { extractRoomCode, findListingIdByRoomCode } from "@/lib/whatsapp/room-code";
import { findStayByPhone, isVerifiedGuest } from "@/lib/whatsapp/stay";

const ROOM_VERIFIED_DAYS = 10;

export async function handleInboundMessage(message: InboundMessage, now = new Date()) {
  const duplicate = await prisma.whatsappMessage.findUnique({ where: { waMessageId: message.id } });
  if (duplicate) return;

  let conversation = await getOrCreateConversation(message.from);
  await recordMessage(conversation.id, "in", "guest", message.text, message.id);
  conversation = await prisma.whatsappConversation.update({
    where: { id: conversation.id },
    data: { lastInboundAt: now, locale: detectLocale(message.text, asLocale(conversation.locale)) },
  });

  if (await handleProviderReply(message.from, message.text, message.buttonId?.startsWith("em:") ? message.buttonId : null)) {
    return;
  }
  if (await isHostPhone(message.from)) {
    await handleHostMessage(message.from, message);
    return;
  }

  const locale = asLocale(conversation.locale);

  const code = extractRoomCode(message.text);
  if (code) {
    const listings = await prisma.listing.findMany({ select: { id: true } });
    const listingId = findListingIdByRoomCode(code, listings.map((l) => l.id));
    if (listingId) {
      const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId }, include: { hotel: true } });
      conversation = await prisma.whatsappConversation.update({
        where: { id: conversation.id },
        data: {
          listingId,
          hotelId: listing.hotelId,
          roomVerifiedUntil: new Date(now.getTime() + ROOM_VERIFIED_DAYS * 24 * 60 * 60 * 1000),
          endedAt: null,
        },
      });
      const rest = message.text.replace(/c[oó]d(?:igo)?\s*[:#]?\s*[A-Z0-9]{6}|code\s*[:#]?\s*[A-Z0-9]{6}/i, "");
      if (!/[?¿]/.test(rest) && rest.trim().split(/\s+/).length <= 8) {
        await sendToPhone(conversation.phone, t("roomWelcome", locale, { room: listing.title, hotel: listing.hotel.name }));
        return;
      }
    }
  }

  if (!conversation.bookingId) {
    const stay = await findStayByPhone(message.from, now);
    if (stay) {
      conversation = await prisma.whatsappConversation.update({
        where: { id: conversation.id },
        data: { bookingId: stay.id, hotelId: stay.listing.hotelId, listingId: stay.listingId },
      });
    }
  }

  if (conversation.endedAt) {
    await askHost(conversation, message.text, "RELAY");
    const ack = t("afterCheckout", locale);
    const recentAck = await prisma.whatsappMessage.findFirst({
      where: { conversationId: conversation.id, body: ack, createdAt: { gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) } },
    });
    if (!recentAck) await sendToPhone(conversation.phone, ack);
    return;
  }
  if (conversation.botPaused) {
    await askHost(conversation, message.text, "RELAY");
    return;
  }

  const [hotel, listing, answers, history] = await Promise.all([
    conversation.hotelId ? prisma.hotel.findUnique({ where: { id: conversation.hotelId } }) : null,
    conversation.listingId ? prisma.listing.findUnique({ where: { id: conversation.listingId } }) : null,
    answersFor(conversation.hotelId, conversation.listingId),
    prisma.whatsappMessage.findMany({
      where: { conversationId: conversation.id, waMessageId: { not: message.id } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  const verified = isVerifiedGuest(conversation, now);

  let decision: AgentDecision;
  try {
    if (!isAgentLlmConfigured()) throw new Error("LLM not configured");
    decision = await runAgent({ hotel, listing, verified, locale, answers, history: history.reverse(), text: message.text });
  } catch (error) {
    console.error("[whatsapp-agent] falling back to rules", error);
    const service = detectEmergencyByKeywords(message.text);
    const match = service ? null : bestKeywordMatch(message.text, answers);
    decision = service
      ? { kind: "emergency", service, description: message.text }
      : match && (!match.verifiedOnly || verified)
        ? { kind: "reply", text: match.answer }
        : match
          ? { kind: "needs_verification" }
          : { kind: "ask_host", question: message.text };
  }

  switch (decision.kind) {
    case "reply":
      await sendToPhone(conversation.phone, decision.text);
      return;
    case "needs_verification":
      await sendToPhone(conversation.phone, t("needsVerification", locale));
      return;
    case "emergency":
      await startEmergency(conversation, decision.service, decision.description);
      return;
    case "ask_host": {
      const thread = await askHost(conversation, decision.question, "QUESTION");
      await sendToPhone(conversation.phone, thread ? t("askingHost", locale) : t("fallbackError", locale));
      return;
    }
  }
}
