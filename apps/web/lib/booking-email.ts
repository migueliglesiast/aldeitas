import { sendEmail } from "@/lib/email/send";
import { recordBookingEvent, type BookingEventStep } from "@/lib/booking-events";
import { prisma } from "@/lib/prisma";
import { resolveBookingNotifyEmails } from "@/lib/email/notify-admins";
import { loadEmailBrand, type EmailBrand } from "@/lib/email/hotel-brand";
import {
  buildAdminBookingCanceledEmail,
  buildAdminBookingConfirmedEmail,
  buildAdminBookingProcessingEmail,
  buildBookingCanceledEmail,
  buildBookingConfirmedEmail,
  buildBookingProcessingEmail,
  type BookingWithListing,
} from "@/lib/email/templates/booking";

type EmailMessage = { subject: string; text: string; html: string };

async function withAddons(booking: BookingWithListing): Promise<BookingWithListing> {
  if (booking.addons) return booking;
  const addons = await prisma.bookingAddon.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: "asc" } });
  return { ...booking, addons };
}

async function sendGuestAndAdmins(
  booking: BookingWithListing,
  brand: EmailBrand,
  guestMessage: EmailMessage,
  adminMessage: EmailMessage,
  step: BookingEventStep
) {
  const guest = await sendEmail({ to: booking.guestEmail, fromName: brand.hotelName, ...guestMessage });

  const recipients = await resolveBookingNotifyEmails(booking.listing.hotelId);
  const admin =
    recipients.length === 0
      ? null
      : await sendEmail({
          to: recipients,
          fromName: brand.hotelName,
          ...adminMessage,
          subject: `[Admin] ${adminMessage.subject}`,
        });

  const sentTo = [guest.sent ? booking.guestEmail : null, admin?.sent ? `${recipients.length} admin` : null]
    .filter(Boolean)
    .join(" + ");
  const adminFailure = admin && !admin.sent ? admin : null;
  const failure = guest.sent ? adminFailure : guest;
  if (!failure) {
    await recordBookingEvent(booking.id, step, "ok", `${guestMessage.subject} → ${sentTo}`);
    return;
  }
  const why = failure.reason === "disabled" ? "email not configured" : "send failed";
  const partial = sentTo ? ` (sent: ${sentTo})` : "";
  await recordBookingEvent(booking.id, step, "fail", `${guestMessage.subject} — ${why}${partial}`);
}

export async function sendBookingProcessingEmail(input: BookingWithListing) {
  const booking = await withAddons(input);
  const brand = await loadEmailBrand(booking.listingId);
  await sendGuestAndAdmins(
    booking,
    brand,
    buildBookingProcessingEmail(booking, brand),
    buildAdminBookingProcessingEmail(booking, brand),
    "email_processing"
  );
}

export async function sendBookingConfirmedEmail(input: BookingWithListing) {
  const booking = await withAddons(input);
  const brand = await loadEmailBrand(booking.listingId);
  await sendGuestAndAdmins(
    booking,
    brand,
    buildBookingConfirmedEmail(booking, brand),
    buildAdminBookingConfirmedEmail(booking, brand),
    "email_confirmed"
  );
}

export async function sendBookingCanceledEmail(input: BookingWithListing, reason: string) {
  const booking = await withAddons(input);
  const brand = await loadEmailBrand(booking.listingId);
  await sendGuestAndAdmins(
    booking,
    brand,
    buildBookingCanceledEmail(booking, reason, brand),
    buildAdminBookingCanceledEmail(booking, reason, brand),
    "email_canceled"
  );
}

export { isEmailConfigured } from "@/lib/email/config";
export { verifyEmailTransport } from "@/lib/email/send";
