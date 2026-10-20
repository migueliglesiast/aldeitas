import type { Locale } from "./messages";

export type LegalDoc = "terms" | "privacy";
export type LegalSection = { heading: string; body: string[] };

export const LEGAL_UPDATED = "2026-10-05";

export function legalContent(doc: LegalDoc, locale: Locale, email: string): LegalSection[] {
  return CONTENT[doc][locale].map((section) => ({
    heading: section.heading,
    body: section.body.map((p) => p.replace("{email}", email)),
  }));
}

const CONTENT: Record<LegalDoc, Record<Locale, LegalSection[]>> = {
  terms: {
    es: [
      {
        heading: "Qué es Aldeitas",
        body: [
          "Aldeitas es una plataforma que conecta a huéspedes con hoteles y casas independientes en Puerto Escondido, Oaxaca. Cada alojamiento lo opera su propio anfitrión, que es responsable de la estancia, de sus instalaciones y de sus reglas.",
        ],
      },
      {
        heading: "Reservas y pagos",
        body: [
          "Los precios se muestran en pesos mexicanos antes de reservar. Al reservar, Mercado Pago retiene el monto total en tu tarjeta. El cobro se realiza solo cuando las fechas quedan confirmadas con el alojamiento.",
          "Si las fechas no se pueden confirmar, la reserva se cancela y la retención se libera. El tiempo en que tu banco refleja la liberación depende de tu banco.",
        ],
      },
      {
        heading: "Cancelaciones y cambios",
        body: [
          "Cada alojamiento define sus condiciones de cancelación y cambios. Para solicitar una cancelación o un cambio, escríbenos a {email} con tu código de reserva y lo gestionamos con el anfitrión.",
        ],
      },
      {
        heading: "Responsabilidades del huésped",
        body: [
          "Te comprometes a proporcionar datos de contacto correctos, a respetar el número de huéspedes reservado y las reglas de cada alojamiento.",
        ],
      },
      {
        heading: "Anfitriones",
        body: [
          "Los anfitriones pagan una comisión de 5% por reserva confirmada y se comprometen a mantener su disponibilidad y precios actualizados, incluidos los calendarios conectados de otras plataformas.",
        ],
      },
      {
        heading: "Cambios y contacto",
        body: [
          "Podemos actualizar estos términos; la versión vigente es la publicada en esta página. Para cualquier duda escríbenos a {email}.",
        ],
      },
    ],
    en: [
      {
        heading: "What Aldeitas is",
        body: [
          "Aldeitas is a platform that connects guests with independent hotels and houses in Puerto Escondido, Oaxaca. Each stay is run by its own host, who is responsible for the stay, the property and its rules.",
        ],
      },
      {
        heading: "Bookings and payment",
        body: [
          "Prices are shown in Mexican pesos before you reserve. When you reserve, Mercado Pago holds the full amount on your card. The charge is made only once your dates are confirmed with the property.",
          "If the dates can't be confirmed, the booking is cancelled and the hold is released. How quickly the release shows depends on your bank.",
        ],
      },
      {
        heading: "Cancellations and changes",
        body: [
          "Each property sets its own cancellation and change conditions. To request a cancellation or a change, write to {email} with your booking code and we'll arrange it with the host.",
        ],
      },
      {
        heading: "Guest responsibilities",
        body: [
          "You agree to provide correct contact details and to respect the number of guests booked and the rules of each property.",
        ],
      },
      {
        heading: "Hosts",
        body: [
          "Hosts pay a 5% commission per confirmed booking and agree to keep their availability and prices up to date, including calendars connected from other platforms.",
        ],
      },
      {
        heading: "Changes and contact",
        body: [
          "We may update these terms; the version in force is the one published on this page. For any question, write to {email}.",
        ],
      },
    ],
  },
  privacy: {
    es: [
      {
        heading: "Responsable",
        body: [
          "Aldeitas, con domicilio en Puerto Escondido, Oaxaca, México, es responsable del tratamiento de tus datos personales. Contacto: {email}.",
        ],
      },
      {
        heading: "Datos que recabamos",
        body: [
          "Los datos que nos das al reservar: correo electrónico, teléfono, fechas de la estancia y número de huéspedes. Los datos de tu tarjeta los procesa directamente Mercado Pago; Aldeitas no los recibe ni los guarda.",
        ],
      },
      {
        heading: "Para qué los usamos",
        body: [
          "Para gestionar tu reserva, compartir con el alojamiento lo necesario para recibirte, comunicarnos contigo sobre tu reserva y prevenir fraudes. No vendemos tus datos ni los usamos para publicidad de terceros.",
        ],
      },
      {
        heading: "Con quién los compartimos",
        body: [
          "Con el alojamiento que reservas y con Mercado Pago para procesar el pago. Los calendarios públicos que compartimos con otras plataformas solo muestran fechas ocupadas, sin datos del huésped.",
        ],
      },
      {
        heading: "Cookies y almacenamiento",
        body: [
          "Usamos una cookie de sesión para los anfitriones que inician sesión y guardamos tu preferencia de idioma en tu navegador. No usamos cookies de publicidad.",
        ],
      },
      {
        heading: "Tus derechos",
        body: [
          "Puedes solicitar el acceso, rectificación, cancelación u oposición al uso de tus datos (derechos ARCO) escribiendo a {email}.",
        ],
      },
      {
        heading: "Cambios a este aviso",
        body: ["Cualquier cambio a este aviso se publicará en esta página."],
      },
    ],
    en: [
      {
        heading: "Who is responsible",
        body: [
          "Aldeitas, based in Puerto Escondido, Oaxaca, Mexico, is responsible for processing your personal data. Contact: {email}.",
        ],
      },
      {
        heading: "What we collect",
        body: [
          "The details you give us when you book: email, phone, stay dates and number of guests. Your card details are processed directly by Mercado Pago; Aldeitas never receives or stores them.",
        ],
      },
      {
        heading: "How we use it",
        body: [
          "To manage your booking, share with the property what it needs to host you, contact you about your booking and prevent fraud. We don't sell your data or use it for third-party advertising.",
        ],
      },
      {
        heading: "Who we share it with",
        body: [
          "The property you book and Mercado Pago, to process the payment. Public calendars we share with other platforms only show booked dates, with no guest details.",
        ],
      },
      {
        heading: "Cookies and storage",
        body: [
          "We use a session cookie for hosts who sign in and store your language preference in your browser. We don't use advertising cookies.",
        ],
      },
      {
        heading: "Your rights",
        body: [
          "You can request access to, correction or deletion of your data, or object to its use (ARCO rights), by writing to {email}.",
        ],
      },
      {
        heading: "Changes to this notice",
        body: ["Any change to this notice will be published on this page."],
      },
    ],
  },
};
