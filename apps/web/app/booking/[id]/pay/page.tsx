import MercadoPagoPayClient from "./MercadoPagoPayClient";
import { getMercadoPagoPublicKey } from "@/lib/payment-providers/config";

export default function BookingPayPage({ params }: { params: { id: string } }) {
  const publicKey = getMercadoPagoPublicKey();

  if (!publicKey) {
    return (
      <div className="mx-auto max-w-lg rounded border border-amber-200 bg-amber-50 p-6 text-amber-900">
        Mercado Pago is not configured. Add NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY to your environment.
      </div>
    );
  }

  return <MercadoPagoPayClient bookingId={params.id} publicKey={publicKey} />;
}
