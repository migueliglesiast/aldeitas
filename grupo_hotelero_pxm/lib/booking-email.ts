import type { Booking, Listing } from "@prisma/client";
import { sendEmail } from "@/lib/email/send";
import { resolveBookingNotifyEmails } from "@/lib/email/notify-admins";
import {
  buildAdminBookingCanceledEmail,
  buildAdminBookingConfirmedEmail,
  buildAdminBookingProcessingEmail,
  buildBookingCanceledEmail,
  buildBookingConfirmedEmail,
  buildBookingProcessingEmail,
  type BookingWithListing,
} from "@/lib/email/templates/booking";

async function notifyAdminsForBooking(
  booking: BookingWithListing,
  message: { subject: string; text: string; html: string }
) {
  const hotelId = booking.listing.hotelId;
  const recipients = await resolveBookingNotifyEmails(hotelId);
  if (recipients.length === 0) return;

  await sendEmail({
    to: recipients,
    subject: `[Admin] ${message.subject}`,
    text: message.text,
    html: message.html,
  });
}

export async function sendBookingProcessingEmail(booking: BookingWithListing) {
  const guestMessage = buildBookingProcessingEmail(booking);
  await sendEmail({
    to: booking.guestEmail,
    subject: guestMessage.subject,
    text: guestMessage.text,
    html: guestMessage.html,
  });

  await notifyAdminsForBooking(booking, buildAdminBookingProcessingEmail(booking));
}

export async function sendBookingConfirmedEmail(booking: BookingWithListing) {
  const guestMessage = buildBookingConfirmedEmail(booking);
  await sendEmail({
    to: booking.guestEmail,
    subject: guestMessage.subject,
    text: guestMessage.text,
    html: guestMessage.html,
  });

  await notifyAdminsForBooking(booking, buildAdminBookingConfirmedEmail(booking));
}

export async function sendBookingCanceledEmail(
  booking: BookingWithListing,
  reason: string
) {
  const guestMessage = buildBookingCanceledEmail(booking, reason);
  await sendEmail({
    to: booking.guestEmail,
    subject: guestMessage.subject,
    text: guestMessage.text,
    html: guestMessage.html,
  });

  await notifyAdminsForBooking(
    booking,
    buildAdminBookingCanceledEmail(booking, reason)
  );
}

export { isEmailConfigured } from "@/lib/email/config";
export { verifyEmailTransport } from "@/lib/email/send";
