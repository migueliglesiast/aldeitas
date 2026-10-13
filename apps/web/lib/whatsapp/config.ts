export function isWhatsappConfigured() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export function isAgentLlmConfigured() {
  return Boolean(process.env.AGENT_LLM_API_KEY);
}

export const WHATSAPP_GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";

export function minutesFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
