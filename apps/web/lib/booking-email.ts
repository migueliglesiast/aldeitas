import { sendEmail } from "@/lib/email/send";
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
  adminMessage: EmailMessage
) {
  await sendEmail({ to: booking.guestEmail, fromName: brand.hotelName, ...guestMessage });

  const recipients = await resolveBookingNotifyEmails(booking.listing.hotelId);
  if (recipients.length === 0) return;
  await sendEmail({
    to: recipients,
    fromName: brand.hotelName,
    ...adminMessage,
    subject: `[Admin] ${adminMessage.subject}`,
  });
}

export async function sendBookingProcessingEmail(input: BookingWithListing) {
  const booking = await withAddons(input);
  const brand = await loadEmailBrand(booking.listingId);
  await sendGuestAndAdmins(
    booking,
    brand,
    buildBookingProcessingEmail(booking, brand),
    buildAdminBookingProcessingEmail(booking, brand)
  );
}

export async function sendBookingConfirmedEmail(input: BookingWithListing) {
  const booking = await withAddons(input);
  const brand = await loadEmailBrand(booking.listingId);
  await sendGuestAndAdmins(
    booking,
    brand,
    buildBookingConfirmedEmail(booking, brand),
    buildAdminBookingConfirmedEmail(booking, brand)
  );
}

export async function sendBookingCanceledEmail(input: BookingWithListing, reason: string) {
  const booking = await withAddons(input);
  const brand = await loadEmailBrand(booking.listingId);
  await sendGuestAndAdmins(
    booking,
    brand,
    buildBookingCanceledEmail(booking, reason, brand),
    buildAdminBookingCanceledEmail(booking, reason, brand)
  );
}

export { isEmailConfigured } from "@/lib/email/config";
export { verifyEmailTransport } from "@/lib/email/send";
