import type { Locale } from "./messages";

const en = {
  navButton: "Finish setup",
  navButtonAria: "Finish setting up your hotel, {count} steps left",
  tourButton: "Take the tour",
  close: "Close",
  next: "Next",
  back: "Back",
  save: "Save & continue",
  saving: "Saving…",
  later: "Later",
  finish: "Go to my dashboard",
  stepOf: "{n} of {total}",
  saved: "Saved",
  error: "Something didn't work. Check the fields and try again.",
  allDone: "All set",

  youKicker: "Welcome",
  youTitle: "Keep the commission",
  youBody: "Big platforms take up to 17%. Here it's 5%, and the rest stays with you.",
  youAsk: "Where should we tell you about new bookings?",
  nickname: "What should we call you?",
  nicknamePh: "Miguel",
  whatsapp: "Your WhatsApp",
  whatsappPh: "+52 954 123 4567",

  storyKicker: "Your own site",
  storyTitle: "A booking page that sells for you",
  storyBody: "Write once in your language. Guests read it in English or Spanish.",
  description: "Describe your place in a few lines",
  descriptionPh: "Treehouses among the palms, 5 minutes from Zicatela beach…",

  mapKicker: "Easy to find",
  mapTitle: "No more “how do I get there?”",
  mapBody: "Guests see your exact pin before they book.",
  location: "Town",
  locationPh: "Puerto Escondido, Oaxaca",
  maps: "Google Maps link",
  mapsPh: "https://maps.app.goo.gl/…",
  mapsHint: "In Google Maps: tap your place → Share → Copy link.",
  mapNotFound: "We couldn't read that link. Paste coordinates like 15.84, -97.05.",

  airbnbKicker: "One click",
  airbnbTitle: "Bring your Airbnb listing",
  airbnbBody: "Photos come over in seconds, and your prices update on their own.",
  airbnbAsk: "Paste each room's Airbnb link",
  airbnbHint: "On Airbnb: open the listing → Share → Copy link.",
  airbnbPh: "https://www.airbnb.com/rooms/…",
  importing: "Importing photos…",
  photosImported: "{count} photos",

  calKicker: "Zero double bookings",
  calTitle: "Every channel, one calendar",
  calBody: "Airbnb, Booking.com and Vrbo block each other automatically.",
  calAsk: "Paste each room's calendar link",
  calHint: "On Airbnb: Calendar → Availability → Connect calendars → Export.",
  calPh: "https://www.airbnb.com/calendar/ical/…",
  connected: "Connected",

  inboxKicker: "No more copy-paste",
  inboxTitle: "Guests fill themselves in",
  inboxBody: "Names, headcounts and payouts land on your calendar straight from your booking emails.",
  inboxAsk: "Gmail that receives your booking emails",
  gmail: "Gmail address",
  gmailPh: "myhotel@gmail.com",
  gmailCode: "App password (16 letters)",
  gmailCodeHint: "Create it here:",
  gmailCodeLink: "Google app passwords",

  teamKicker: "Calm mornings",
  teamTitle: "Your team knows the day ahead",
  teamBody: "Cleaners get a calendar with check-outs and guest counts. No money, no calls.",
  cleaner: "Cleaner",
  maintenance: "Maintenance (optional)",
  name: "Name",
  phone: "Phone",
  cleanerLink: "Send them this link",
  copy: "Copy",
  copied: "Copied",

  doneKicker: "Ready",
  doneTitle: "Your hotel at a glance",
  doneBody: "Occupancy, revenue and the next 7 days, from your phone.",
  ownerLink: "Your private dashboard",

  demoBooking: "New booking",
  demoGuests: "2 guests",
  demoTonight: "Tonight",
  demoCheckouts: "2 check-outs today",
  demoOccupancy: "Next 7 days",
  demoRevenue: "Booked",
  demoCopied: "Link copied",
  demoExport: "Export calendar",
};

type Copy = typeof en;

const es: Copy = {
  navButton: "Completar perfil",
  navButtonAria: "Termina de configurar tu hotel, faltan {count} pasos",
  tourButton: "Ver recorrido",
  close: "Cerrar",
  next: "Siguiente",
  back: "Atrás",
  save: "Guardar y seguir",
  saving: "Guardando…",
  later: "Más tarde",
  finish: "Ir a mi panel",
  stepOf: "{n} de {total}",
  saved: "Guardado",
  error: "Algo no funcionó. Revisa los campos e inténtalo de nuevo.",
  allDone: "Todo listo",

  youKicker: "Bienvenido",
  youTitle: "Quédate con la comisión",
  youBody: "Las grandes plataformas cobran hasta 17%. Aquí es 5%, y el resto es tuyo.",
  youAsk: "¿Dónde te avisamos de nuevas reservas?",
  nickname: "¿Cómo te llamamos?",
  nicknamePh: "Miguel",
  whatsapp: "Tu WhatsApp",
  whatsappPh: "+52 954 123 4567",

  storyKicker: "Tu propio sitio",
  storyTitle: "Una página que vende por ti",
  storyBody: "Escribe una vez en tu idioma. Tus huéspedes lo leen en español o inglés.",
  description: "Describe tu lugar en pocas líneas",
  descriptionPh: "Casas del árbol entre palmeras, a 5 minutos de Zicatela…",

  mapKicker: "Fácil de encontrar",
  mapTitle: "Adiós al “¿cómo llego?”",
  mapBody: "Tus huéspedes ven tu ubicación exacta antes de reservar.",
  location: "Ciudad",
  locationPh: "Puerto Escondido, Oaxaca",
  maps: "Enlace de Google Maps",
  mapsPh: "https://maps.app.goo.gl/…",
  mapsHint: "En Google Maps: toca tu lugar → Compartir → Copiar enlace.",
  mapNotFound: "No pudimos leer ese enlace. Pega coordenadas como 15.84, -97.05.",

  airbnbKicker: "Un clic",
  airbnbTitle: "Trae tu anuncio de Airbnb",
  airbnbBody: "Las fotos llegan en segundos y tus precios se actualizan solos.",
  airbnbAsk: "Pega el enlace de Airbnb de cada cuarto",
  airbnbHint: "En Airbnb: abre el anuncio → Compartir → Copiar enlace.",
  airbnbPh: "https://www.airbnb.mx/rooms/…",
  importing: "Importando fotos…",
  photosImported: "{count} fotos",

  calKicker: "Cero reservas dobles",
  calTitle: "Todos tus canales, un calendario",
  calBody: "Airbnb, Booking.com y Vrbo se bloquean entre sí automáticamente.",
  calAsk: "Pega el enlace de calendario de cada cuarto",
  calHint: "En Airbnb: Calendario → Disponibilidad → Conectar calendarios → Exportar.",
  calPh: "https://www.airbnb.mx/calendar/ical/…",
  connected: "Conectado",

  inboxKicker: "Sin copiar y pegar",
  inboxTitle: "Tus huéspedes se registran solos",
  inboxBody: "Nombres, número de huéspedes y pagos llegan a tu calendario desde tus correos de reserva.",
  inboxAsk: "Gmail donde recibes tus reservas",
  gmail: "Correo de Gmail",
  gmailPh: "mihotel@gmail.com",
  gmailCode: "Contraseña de aplicación (16 letras)",
  gmailCodeHint: "Créala aquí:",
  gmailCodeLink: "Contraseñas de aplicación de Google",

  teamKicker: "Mañanas tranquilas",
  teamTitle: "Tu equipo sabe qué viene",
  teamBody: "Limpieza recibe un calendario con salidas y huéspedes. Sin dinero, sin llamadas.",
  cleaner: "Limpieza",
  maintenance: "Mantenimiento (opcional)",
  name: "Nombre",
  phone: "Teléfono",
  cleanerLink: "Mándales este enlace",
  copy: "Copiar",
  copied: "Copiado",

  doneKicker: "Listo",
  doneTitle: "Tu hotel de un vistazo",
  doneBody: "Ocupación, ingresos y los próximos 7 días, desde tu teléfono.",
  ownerLink: "Tu panel privado",

  demoBooking: "Nueva reserva",
  demoGuests: "2 huéspedes",
  demoTonight: "Hoy",
  demoCheckouts: "2 salidas hoy",
  demoOccupancy: "Próximos 7 días",
  demoRevenue: "Reservado",
  demoCopied: "Enlace copiado",
  demoExport: "Exportar calendario",
};

export type OnboardingCopyKey = keyof Copy;

const copy: Record<Locale, Copy> = { en, es };

export function onboardingText(
  locale: Locale,
  key: OnboardingCopyKey,
  vars?: Record<string, string | number>
) {
  let text = copy[locale][key];
  for (const [name, value] of Object.entries(vars ?? {})) {
    text = text.replace(`{${name}}`, String(value));
  }
  return text;
}
