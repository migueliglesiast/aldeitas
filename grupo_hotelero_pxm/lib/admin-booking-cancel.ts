import { prisma } from "@/lib/prisma";
import { releaseAuthorizedBookingPayment } from "@/lib/payment-providers";
import { sendBookingCanceledEmail } from "@/lib/booking-email";

export async function adminCancelBooking(
  bookingId: string,
  reason = "Canceled by hotel admin."
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { listing: true },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.status === "CANCELED") {
    return booking;
  }

  if (booking.status === "PENDING" && booking.authorizedAt) {
    await releaseAuthorizedBookingPayment(booking);
  }

  if (booking.status === "CONFIRMED" && booking.paymentOrderId) {
    try {
      await releaseAuthorizedBookingPayment(booking);
    } catch (error) {
      console.error("[admin-cancel] payment release/refund may need manual action:", error);
    }
  }

  const canceled = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "CANCELED",
      cancelReason: reason,
      lastReconciledAt: new Date(),
    },
    include: { listing: true },
  });

  if (booking.authorizedAt || booking.status === "CONFIRMED") {
    await sendBookingCanceledEmail(canceled, reason);
  }

  return canceled;
}
