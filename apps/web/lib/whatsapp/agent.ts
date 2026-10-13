import type { GuestAnswer, Hotel, Listing, WhatsappMessage } from "@prisma/client";
import { chatCompletion, type ChatMessage, type ToolDefinition } from "@/lib/whatsapp/llm";
import { guestServices, type EmergencyService } from "@/lib/whatsapp/providers-sheet";
import type { Locale } from "@/lib/whatsapp/copy";

export type AgentDecision =
  | { kind: "reply"; text: string }
  | { kind: "emergency"; service: EmergencyService; description: string }
  | { kind: "ask_host"; question: string }
  | { kind: "needs_verification" };

export type AgentContext = {
  hotel: Hotel | null;
  listing: Listing | null;
  verified: boolean;
  locale: Locale;
  answers: GuestAnswer[];
  history: Pick<WhatsappMessage, "author" | "body">[];
  text: string;
};

const TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "report_emergency",
      description:
        "Use ONLY for an urgent plumbing or electrical problem at the property (leak, flooding, burst pipe, clogged toilet overflowing, no power, sparks, burning outlet). Dispatches the hotel's plumber or electrician.",
      parameters: {
        type: "object",
        properties: {
          service: { type: "string", enum: ["plumbing", "electrical"] },
          description: { type: "string", description: "One-sentence summary of the problem in Spanish" },
        },
        required: ["service", "description"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_host",
      description:
        "Use when the guest asks something about the property, their stay or a request that the knowledge base does not answer. The host will reply.",
      parameters: {
        type: "object",
        properties: { question: { type: "string", description: "The guest's question, rewritten clearly in Spanish" } },
        required: ["question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "needs_verification",
      description: "Use when the guest asks for an answer marked [VERIFIED GUESTS ONLY] (like WiFi or door codes).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "local_services",
      description: "Returns trusted local contacts for guests: taxi, moto rental, tours, delivery.",
      parameters: { type: "object", properties: {} },
    },
  },
];

function systemPrompt(ctx: AgentContext) {
  const kb = ctx.answers.length
    ? ctx.answers
        .map((a, i) =>
          a.verifiedOnly && !ctx.verified
            ? `${i + 1}. Q: ${a.question}\n   A: [VERIFIED GUESTS ONLY]`
            : `${i + 1}. Q: ${a.question}\n   A: ${a.answer}`
        )
        .join("\n")
    : "(empty)";
  const place = ctx.hotel
    ? [
        `Hotel: ${ctx.hotel.name}. Address: ${ctx.hotel.location}.`,
        ctx.hotel.googleMapsUrl ? `Map: ${ctx.hotel.googleMapsUrl}.` : "",
        ctx.listing ? `Guest's room: ${ctx.listing.title}.` : "",
      ]
        .filter(Boolean)
        .join(" ")
    : "The guest's hotel is not known yet. If they ask about the property, ask them to scan the QR code in their room.";
  return [
    "You are the WhatsApp guest assistant for Aldeitas boutique stays in Puerto Escondido, Oaxaca, Mexico.",
    place,
    "Knowledge base written by the host:",
    kb,
    "Rules:",
    "- Facts about the property (WiFi, rules, times, amenities, codes, prices) may ONLY come from the knowledge base or the hotel info above. Never guess them. If they are not there, call ask_host.",
    "- General tips about Puerto Escondido (beaches, food, safety basics) are fine; keep them brief and suggest asking the host for specifics.",
    "- Plumbing or electrical emergencies: call report_emergency immediately.",
    "- For taxis, motos, tours or delivery, call local_services and share the contacts.",
    "- Never discuss, change or cancel bookings or payments; call ask_host instead.",
    `- Reply in the guest's language (default ${ctx.locale === "en" ? "English" : "Spanish"}), warm and short (1-4 sentences), plain WhatsApp text without markdown headings.`,
  ].join("\n");
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw || "{}");
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function runAgent(ctx: AgentContext): Promise<AgentDecision> {
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt(ctx) }];
  for (const m of ctx.history.slice(-10)) {
    messages.push(m.author === "guest" ? { role: "user", content: m.body } : { role: "assistant", content: m.body });
  }
  messages.push({ role: "user", content: ctx.text });

  for (let step = 0; step < 3; step += 1) {
    const result = await chatCompletion(messages, TOOLS);
    const call = result.toolCalls[0];
    if (!call) {
      if (result.content) return { kind: "reply", text: result.content };
      break;
    }
    const args = parseArgs(call.function.arguments);
    switch (call.function.name) {
      case "report_emergency": {
        const service = args.service === "electrical" ? "electrical" : "plumbing";
        return { kind: "emergency", service, description: String(args.description || ctx.text) };
      }
      case "ask_host":
        return { kind: "ask_host", question: String(args.question || ctx.text) };
      case "needs_verification":
        return { kind: "needs_verification" };
      case "local_services": {
        messages.push({ role: "assistant", content: result.content, tool_calls: [call] });
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(await guestServices()) });
        break;
      }
      default:
        return { kind: "ask_host", question: ctx.text };
    }
  }
  return { kind: "ask_host", question: ctx.text };
}

const PLUMBING = /\b(fuga|inund|tuber[ií]a|se tap[oó]|tapad[oa]|desborda|drenaje|sale agua|no (hay|sale) agua|leak|flood|burst|pipe|overflow|clogged)\w*/i;
const ELECTRICAL = /\b(sin luz|no hay luz|se fue la luz|apag[oó]n|chispa|corto ?circuito|huele a quemado|enchufe|contacto quemado|no power|power (is )?out|sparks?|burning smell|outlet)\w*/i;

/** Deterministic emergency detection used when the LLM is unavailable. */
export function detectEmergencyByKeywords(text: string): EmergencyService | null {
  if (PLUMBING.test(text)) return "plumbing";
  if (ELECTRICAL.test(text)) return "electrical";
  return null;
}
