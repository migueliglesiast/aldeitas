import MercadoPagoPayClient from "./MercadoPagoPayClient";
import { getMercadoPagoPublicKey } from "@/lib/payment-providers/config";
import { getHotelMercadoPagoMerchant } from "@/lib/mercadopago-merchant";
import { prisma } from "@/lib/prisma";

export default async function BookingPayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const booking = await prisma.booking.findUnique({ where: { id }, select: { listing: { select: { hotelId: true } } } });
  const merchant = booking?.listing?.hotelId ? await getHotelMercadoPagoMerchant(booking.listing.hotelId) : null;
  // Card tokens must be created with the public key of the account that charges them.
  const publicKey = merchant?.publicKey || getMercadoPagoPublicKey();

  if (!publicKey) {
    return (
      <div className="mx-auto max-w-lg rounded border border-amber-200 bg-amber-50 p-6 text-amber-900">
        Mercado Pago is not configured. Add NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY to your environment.
      </div>
    );
  }

  return <MercadoPagoPayClient bookingId={id} publicKey={publicKey} />;
}
