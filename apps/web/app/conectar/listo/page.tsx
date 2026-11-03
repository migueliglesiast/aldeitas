import type { Metadata } from "next";
import { ConnectCard } from "../ConnectCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Mercado Pago · Aldeitas",
  robots: { index: false, follow: false },
};

export default async function ConnectResultPage({ searchParams }: { searchParams: Promise<{ mp?: string }> }) {
  const { mp } = await searchParams;
  if (mp === "connected") {
    return (
      <ConnectCard title="¡Listo, ya quedó conectado!">
        <p>Las reservas ahora se pagan directo en tu Mercado Pago. Ya puedes cerrar esta página.</p>
      </ConnectCard>
    );
  }
  if (mp === "denied") {
    return (
      <ConnectCard title="No se conectó">
        <p>No se aceptó el permiso en Mercado Pago. Vuelve a abrir tu enlace y toca “Conectar Mercado Pago”.</p>
      </ConnectCard>
    );
  }
  return (
    <ConnectCard title="Algo salió mal">
      <p>No pudimos conectar tu Mercado Pago. Vuelve a abrir tu enlace o pide uno nuevo a Aldeitas.</p>
    </ConnectCard>
  );
}
