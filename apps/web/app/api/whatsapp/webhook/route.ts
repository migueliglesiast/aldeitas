import { NextRequest, NextResponse, after } from "next/server";
import { parseInboundMessages, verifyWhatsappSignature } from "@/lib/whatsapp/cloud-api";
import { handleInboundMessage } from "@/lib/whatsapp/inbound";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === token) {
    return new NextResponse(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyWhatsappSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const messages = parseInboundMessages(body as Parameters<typeof parseInboundMessages>[0]);
  if (messages.length) {
    after(async () => {
      for (const message of messages) {
        try {
          await handleInboundMessage(message);
        } catch (error) {
          console.error("[whatsapp] inbound message failed", message.id, error);
        }
      }
    });
  }
  return NextResponse.json({ ok: true });
}
