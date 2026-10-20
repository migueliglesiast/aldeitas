import { createHmac, timingSafeEqual } from "node:crypto";
import { WHATSAPP_GRAPH_VERSION, isWhatsappConfigured } from "@/lib/whatsapp/config";
import { toWhatsappRecipient } from "@/lib/whatsapp/phone";

export type ReplyButton = { id: string; title: string };

export type TemplateMessage = {
  name: string;
  language: string;
  params: string[];
  buttonPayloads?: string[];
};

export function verifyWhatsappSignature(rawBody: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = header.slice("sha256=".length);
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

async function postMessage(payload: Record<string, unknown>): Promise<string | null> {
  if (!isWhatsappConfigured()) {
    console.warn("[whatsapp] not configured; dropping message to %s", payload.to);
    return null;
  }
  const base = process.env.WHATSAPP_GRAPH_BASE_URL || "https://graph.facebook.com";
  const url = `${base}/${WHATSAPP_GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: unknown };
  if (!res.ok) {
    throw new Error(`WhatsApp API ${res.status}: ${JSON.stringify(data.error ?? data)}`);
  }
  return data.messages?.[0]?.id ?? null;
}

export function sendWhatsappText(to: string, body: string, replyToId?: string) {
  return postMessage({
    to: toWhatsappRecipient(to),
    type: "text",
    text: { body: body.slice(0, 4096) },
    ...(replyToId ? { context: { message_id: replyToId } } : {}),
  });
}

export function sendWhatsappButtons(to: string, body: string, buttons: ReplyButton[]) {
  return postMessage({
    to: toWhatsappRecipient(to),
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body.slice(0, 1024) },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })),
      },
    },
  });
}

export function sendWhatsappTemplate(to: string, template: TemplateMessage) {
  return postMessage({
    to: toWhatsappRecipient(to),
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language },
      components: [
        ...(template.params.length
          ? [{ type: "body", parameters: template.params.map((text) => ({ type: "text", text: text.slice(0, 1000) })) }]
          : []),
        ...(template.buttonPayloads ?? []).map((payload, index) => ({
          type: "button",
          sub_type: "quick_reply",
          index: String(index),
          parameters: [{ type: "payload", payload }],
        })),
      ],
    },
  });
}

export type InboundMessage = {
  id: string;
  from: string;
  profileName: string | null;
  text: string;
  buttonId: string | null;
  contextId: string | null;
};

type WebhookMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  button?: { payload?: string; text?: string };
  interactive?: { button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string } };
  image?: { caption?: string };
  context?: { id?: string };
};

type WebhookBody = {
  entry?: {
    changes?: {
      value?: {
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: WebhookMessage[];
      };
    }[];
  }[];
};

export function parseInboundMessages(body: WebhookBody): InboundMessage[] {
  const out: InboundMessage[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const names = new Map((value?.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null]));
      for (const m of value?.messages ?? []) {
        if (!m.id || !m.from) continue;
        const reply = m.interactive?.button_reply ?? m.interactive?.list_reply;
        const text =
          m.text?.body ?? reply?.title ?? m.button?.text ?? m.image?.caption ?? (m.type ? `[${m.type}]` : "");
        out.push({
          id: m.id,
          from: m.from,
          profileName: names.get(m.from) ?? null,
          text,
          buttonId: reply?.id ?? m.button?.payload ?? null,
          contextId: m.context?.id ?? null,
        });
      }
    }
  }
  return out;
}
