export type Locale = "es" | "en";

const EN_HINTS = /\b(hi|hello|hey|the|is|what|where|when|how|thanks|thank you|please|password|room|can|does|there|water|light)\b/gi;
const ES_HINTS = /\b(hola|el|la|los|las|es|qué|que|dónde|donde|cuándo|cómo|como|gracias|por favor|contraseña|cuarto|habitación|hay|agua|luz|puedo)\b/gi;

export function detectLocale(text: string, fallback: Locale): Locale {
  const en = text.match(EN_HINTS)?.length ?? 0;
  const es = text.match(ES_HINTS)?.length ?? 0;
  if (en > es) return "en";
  if (es > en) return "es";
  return fallback;
}

export function asLocale(value: string | null | undefined): Locale {
  return value === "en" ? "en" : "es";
}

type Vars = Record<string, string>;
const fill = (text: string, vars: Vars) => text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");

const COPY = {
  welcome: {
    es: "¡Hola {name}! Soy el asistente de {hotel} en Aldeitas. Tu reserva del {checkIn} al {checkOut} está confirmada. Escríbeme aquí cuando quieras: WiFi, reglas de la casa, recomendaciones o cualquier problema.",
    en: "Hi {name}! I'm the {hotel} assistant at Aldeitas. Your stay from {checkIn} to {checkOut} is confirmed. Message me here anytime: WiFi, house rules, tips or any problem.",
  },
  roomWelcome: {
    es: "¡Bienvenido a {room} en {hotel}! Soy el asistente de la casa. Pregúntame lo que necesites: WiFi, reglas, recomendaciones o cualquier problema.",
    en: "Welcome to {room} at {hotel}! I'm the house assistant. Ask me anything: WiFi, house rules, tips or any problem.",
  },
  checkinInfo: {
    es: "Mañana es tu llegada a {hotel}. Dirección: {location}. {map}Si necesitas algo antes de llegar, escríbeme aquí.",
    en: "You arrive at {hotel} tomorrow. Address: {location}. {map}If you need anything before you arrive, message me here.",
  },
  goodbye: {
    es: "Espero haber sido de ayuda para que tu estancia en {hotel} fuera cómoda y tu experiencia en Puerto más fácil. ¡Buen viaje!",
    en: "I hope I helped make your stay at {hotel} comfortable and your time in Puerto a little easier. Safe travels!",
  },
  askingHost: {
    es: "Buena pregunta. Déjame confirmarlo con el anfitrión y te escribo en cuanto me responda.",
    en: "Good question. Let me check with the host and I'll get back to you as soon as they reply.",
  },
  hostAnswerPrefix: { es: "El anfitrión dice: ", en: "The host says: " },
  emergencyAck: {
    es: "Entendido, ya estoy contactando a {kind}. Te aviso en cuanto confirme. Si hay riesgo (agua sobre enchufes, chispas, olor a quemado), aléjate de la zona y corta la llave o el interruptor general si puedes hacerlo con seguridad.",
    en: "Got it, I'm contacting {kind} now and will let you know as soon as they confirm. If there's any danger (water near outlets, sparks, burning smell), keep away and shut off the main valve or breaker if it's safe to do so.",
  },
  emergencyOnTheWay: {
    es: "{provider} confirmó y va en camino. El anfitrión también está avisado.",
    en: "{provider} confirmed and is on the way. The host has been notified too.",
  },
  emergencyNoProvider: {
    es: "No logré confirmar con nadie todavía, así que el anfitrión se está encargando directamente. Te escribirá pronto.",
    en: "I couldn't get a confirmation yet, so the host is handling it directly and will message you soon.",
  },
  needsVerification: {
    es: "Por seguridad solo comparto ese dato con huéspedes de la casa. Escanea el código QR de tu habitación o escríbeme el código que aparece ahí.",
    en: "For security I only share that with current guests. Scan the QR code in your room or send me the code printed there.",
  },
  afterCheckout: {
    es: "Le paso tu mensaje al anfitrión, que te responderá directamente por aquí.",
    en: "I've passed your message to the host, who will reply to you here.",
  },
  fallbackError: {
    es: "Perdón, tuve un problema. Le paso tu mensaje al anfitrión.",
    en: "Sorry, something went wrong on my side. I've passed your message to the host.",
  },
} as const;

export type CopyKey = keyof typeof COPY;

export function t(key: CopyKey, locale: Locale, vars: Vars = {}) {
  return fill(COPY[key][locale], vars);
}

export function emergencyKind(service: "plumbing" | "electrical", locale: Locale) {
  if (service === "plumbing") return locale === "en" ? "the plumber" : "al plomero";
  return locale === "en" ? "the electrician" : "al electricista";
}

export const TEMPLATES = {
  welcome: process.env.WHATSAPP_TEMPLATE_WELCOME || "aldeitas_booking_welcome",
  checkin: process.env.WHATSAPP_TEMPLATE_CHECKIN || "aldeitas_checkin_info",
  goodbye: process.env.WHATSAPP_TEMPLATE_GOODBYE || "aldeitas_checkout_goodbye",
  hostQuestion: process.env.WHATSAPP_TEMPLATE_HOST_QUESTION || "aldeitas_host_question",
  emergency: process.env.WHATSAPP_TEMPLATE_EMERGENCY || "aldeitas_emergency_alert",
};

export function templateLanguage(locale: Locale) {
  return locale === "en" ? "en" : "es_MX";
}
