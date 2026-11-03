import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { verifyMercadoPagoInvite } from "@/lib/mercadopago-oauth";
import { ConnectCard } from "../ConnectCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Conecta tu Mercado Pago · Aldeitas",
  robots: { index: false, follow: false },
};

export default async function ConnectMercadoPagoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = verifyMercadoPagoInvite(token);
  const hotel = invite
    ? await prisma.hotel.findUnique({
        where: { id: invite.hotelId },
        select: { name: true, logoImageUrl: true, mercadoPagoConnectedAt: true },
      })
    : null;

  if (!hotel) {
    return (
      <ConnectCard title="Este enlace ya no funciona">
        <p>Pide un enlace nuevo a Aldeitas.</p>
      </ConnectCard>
    );
  }

  if (hotel.mercadoPagoConnectedAt) {
    return (
      <ConnectCard title="¡Listo! Ya está conectado">
        <p>{hotel.name} ya recibe sus pagos en su Mercado Pago. No tienes que hacer nada más.</p>
      </ConnectCard>
    );
  }

  return (
    <ConnectCard title="Recibe tus pagos en Mercado Pago">
      {hotel.logoImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hotel.logoImageUrl} alt={hotel.name} className="mx-auto h-16 w-16 rounded-full object-cover" />
      )}
      <p>
        Hola, solo toca el botón y acepta en Mercado Pago. Así el dinero de las reservas de{" "}
        <strong className="text-ink">{hotel.name}</strong> llega directo a tu cuenta.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/banks/722.png" alt="Mercado Pago" className="mx-auto h-10 w-auto" />
      <a
        href={`/api/mercadopago/oauth/invite?t=${encodeURIComponent(token)}`}
        className="block w-full rounded-2xl bg-[#009ee3] px-6 py-4 text-lg font-bold text-white shadow-card hover:bg-[#008acb]"
      >
        Conectar Mercado Pago
      </a>
      <p className="text-sm">Tarda menos de un minuto. No necesitas contraseña de Aldeitas.</p>
    </ConnectCard>
  );
}
