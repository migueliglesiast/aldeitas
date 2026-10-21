export const CANCEL_REASON_DATES_TAKEN =
  "Those dates became unavailable before we could secure your booking. We are sorry for the inconvenience.";
export const CANCEL_REASON_DATES_UNVERIFIABLE =
  "We couldn't confirm those dates with the property's calendar, so your card was not charged. Please try again in a few minutes.";
export const CANCEL_REASON_LOCAL_CONFLICT =
  "Those dates were reserved by another guest while we processed your request. We are sorry for the inconvenience.";
export const CANCEL_REASON_OTHER_CHANNEL =
  "Those dates were booked on another channel while we processed your request. We are sorry for the inconvenience.";
export const CANCEL_REASON_CALENDAR_OUTAGE =
  "We couldn't confirm your dates with the property's calendar, so your card was not charged. We are sorry for the inconvenience.";
export const CANCEL_REASON_ADMIN = "Canceled by hotel admin.";

const TRANSLATIONS: Record<string, string> = {
  [CANCEL_REASON_DATES_TAKEN]: "Alguien más tomó esas fechas justo antes de que pudiéramos asegurarlas.",
  [CANCEL_REASON_DATES_UNVERIFIABLE]:
    "No pudimos verificar esas fechas con el calendario del alojamiento. Inténtalo de nuevo en unos minutos.",
  [CANCEL_REASON_LOCAL_CONFLICT]: "Otro huésped reservó esas fechas mientras procesábamos tu solicitud.",
  [CANCEL_REASON_OTHER_CHANNEL]:
    "Esas fechas se reservaron en otra plataforma (Airbnb, Booking o Vrbo) mientras revisábamos los calendarios.",
  [CANCEL_REASON_CALENDAR_OUTAGE]: "No pudimos confirmar tus fechas con el calendario del alojamiento a tiempo.",
  [CANCEL_REASON_ADMIN]: "El hotel canceló esta reserva.",
};

export function describeCancelReason(reason: string) {
  return { es: TRANSLATIONS[reason] ?? reason, en: TRANSLATIONS[reason] ? reason : null };
}
