"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "./mercadopago-pay.css";
import { formatMoney } from "@/lib/currency";

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale?: string }) => {
      bricks: () => {
        create: (
          brick: string,
          containerId: string,
          settings: Record<string, unknown>
        ) => Promise<{ unmount: () => void }>;
      };
    };
  }
}

type BookingPayDetails = {
  id: string;
  guestEmail: string;
  totalPriceCents: number;
  currency: string;
  status: string;
  authorizedAt: string | null;
  listing: { title: string; id: string };
  mercadoPagoPayerEmail?: string;
  mercadoPagoChargeAmountCents?: number;
  mercadoPagoChargeCurrency?: string;
  mercadoPagoSandbox?: boolean;
};

const MP_BLUE = "#009EE3";
const MP_BLUE_DARK = "#007EB5";
const MP_FONT_URL =
  "https://fonts.gstatic.com/s/poppins/v21/pxiEyp8kv8JHgFVrJJfecg.woff2";
const SECTION_CLASS = "px-6 py-5";

function formatMercadoPagoError(message?: string) {
  const raw = message?.trim() || "";
  if (!raw) return "No se pudo procesar el pago. Intenta de nuevo.";

  const code = raw.toLowerCase();
  if (code.includes("no_payment_method_for_provided_bin")) {
    return "Tarjeta no reconocida para pruebas en México. Usa 5474 9254 3267 0366 (Mastercard), CVV 123, vencimiento 11/30 y titular APRO.";
  }
  if (code.includes("invalid") && code.includes("format")) {
    return "Revisa el número de tarjeta. Para pruebas en México usa 5474 9254 3267 0366.";
  }
  if (code.includes("invalid_email_for_sandbox") || code.includes("testuser.com")) {
    return "En modo prueba, Mercado Pago solo acepta correos @testuser.com. Reserva con test@testuser.com.";
  }

  return raw;
}

function AuthorizationNotice() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#009EE3]/20 bg-[#F7FCFF] px-4 py-3.5 pl-5">
      <div
        className="absolute inset-y-0 left-0 w-1 bg-[#009EE3]"
        aria-hidden
      />
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#009EE3]/10">
          <LockIcon className="h-3.5 w-3.5 text-[#009EE3]" />
        </span>
        <p className="text-sm leading-relaxed text-gray-700">
          Tu tarjeta se autorizará ahora.{" "}
          <span className="font-medium text-gray-900">
            Solo se cobrará cuando tu reserva esté confirmada.
          </span>
        </p>
      </div>
    </div>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function FormSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="h-4 w-36 rounded bg-gray-200" />
      <div className="h-12 rounded-lg bg-gray-100" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-12 rounded-lg bg-gray-100" />
        <div className="h-12 rounded-lg bg-gray-100" />
      </div>
      <div className="h-12 rounded-lg bg-gray-100" />
      <div className="h-12 rounded-lg bg-[#009EE3]/15" />
    </div>
  );
}

function PayCardShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:py-10">
      <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] ring-1 ring-gray-200/80">
        {children}
      </div>
    </div>
  );
}

export default function MercadoPagoPayClient({
  bookingId,
  publicKey,
}: {
  bookingId: string;
  publicKey: string;
}) {
  const router = useRouter();
  const [booking, setBooking] = useState<BookingPayDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [brickReady, setBrickReady] = useState(false);

  useEffect(() => {
    fetch(`/api/bookings/${bookingId}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setBooking(data);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [bookingId]);

  useEffect(() => {
    if (booking?.authorizedAt || (booking && booking.status !== "PENDING")) {
      router.replace(`/booking/${bookingId}`);
    }
  }, [booking, bookingId, router]);

  useEffect(() => {
    const currentBooking = booking;
    if (!currentBooking || currentBooking.authorizedAt || currentBooking.status !== "PENDING" || !publicKey) {
      return;
    }

    let mounted = true;
    let brickController: { unmount: () => void } | null = null;
    setBrickReady(false);

    async function mountBrick() {
      if (!window.MercadoPago) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://sdk.mercadopago.com/js/v2";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Mercado Pago SDK"));
          document.body.appendChild(script);
        });
      }

      if (!mounted || !window.MercadoPago) return;

      const mp = new window.MercadoPago(publicKey, { locale: "es-MX" });
      const chargeAmountCents =
        currentBooking.mercadoPagoChargeAmountCents ?? currentBooking.totalPriceCents;

      brickController = await mp.bricks().create("cardPayment", "mp-card-payment", {
        initialization: {
          amount: chargeAmountCents / 100,
          payer: {
            email:
              currentBooking.mercadoPagoPayerEmail ?? currentBooking.guestEmail,
          },
        },
        customization: {
          visual: {
            hideFormTitle: true,
            font: MP_FONT_URL,
            style: {
              theme: "default",
              customVariables: {
                baseColor: MP_BLUE,
                baseColorFirstVariant: MP_BLUE_DARK,
                baseColorSecondVariant: MP_BLUE_DARK,
                buttonTextColor: "#FFFFFF",
                outlinePrimaryColor: "#D1D5DB",
                outlineSecondaryColor: "#E5E7EB",
                formBackgroundColor: "#FFFFFF",
                inputBackgroundColor: "#FFFFFF",
                textPrimaryColor: "rgba(0, 0, 0, 0.88)",
                textSecondaryColor: "rgba(0, 0, 0, 0.55)",
                borderRadiusSmall: "8px",
                borderRadiusMedium: "8px",
                borderRadiusLarge: "8px",
                fontSizeSmall: "14px",
                fontSizeMedium: "14px",
                fontWeightNormal: "400",
                fontWeightSemiBold: "600",
                inputVerticalPadding: "12px",
                inputHorizontalPadding: "12px",
                inputBorderWidth: "1px",
                inputFocusedBorderWidth: "1px",
                formPadding: "0px",
              },
            },
            texts: {
              emailSectionTitle: "",
              formSubmit: "Pagar",
            },
          },
        },
        callbacks: {
          onReady: () => {
            if (mounted) {
              setBrickReady(true);
              setError(null);
              const submitButton = document.querySelector(
                "#mp-card-payment button[type='submit']"
              ) as HTMLButtonElement | null;
              if (submitButton) {
                submitButton.style.marginTop = "16px";
              }
            }
          },
          onSubmit: (cardData: {
            token?: string;
            payment_method_id?: string;
            paymentMethodId?: string;
            installments?: number | string;
          }) => {
            setSubmitting(true);
            setError(null);
            return fetch(`/api/bookings/${bookingId}/pay`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: cardData.token,
                payment_method_id: cardData.payment_method_id ?? cardData.paymentMethodId,
                installments: cardData.installments ?? 1,
              }),
            })
              .then(async (response) => {
                const data = await response.json();
                if (!response.ok) {
                  throw new Error(data.error || "Payment authorization failed");
                }
                router.push(data.statusUrl || `/booking/${bookingId}`);
              })
              .catch((err: Error) => {
                setError(formatMercadoPagoError(err.message));
                throw err;
              })
              .finally(() => {
                setSubmitting(false);
              });
          },
          onError: (err: { message?: string }) => {
            setError(formatMercadoPagoError(err.message));
          },
        },
      });
    }

    mountBrick().catch((err: Error) => setError(err.message));

    return () => {
      mounted = false;
      setBrickReady(false);
      brickController?.unmount();
    };
  }, [booking, bookingId, publicKey, router]);

  const amountLabel = useMemo(() => {
    if (!booking) return "";
    const chargeCents = booking.mercadoPagoChargeAmountCents ?? booking.totalPriceCents;
    const chargeCurrency = booking.mercadoPagoChargeCurrency ?? booking.currency;
    return formatMoney(chargeCents, chargeCurrency);
  }, [booking]);

  if (loading) {
    return (
      <PayCardShell>
        <div className={`${SECTION_CLASS} border-b border-gray-100`}>
          <div className="flex justify-center">
            <div className="h-14 w-48 animate-pulse rounded bg-gray-100 sm:h-16" />
          </div>
        </div>
        <div className={SECTION_CLASS}>
          <FormSkeleton />
        </div>
      </PayCardShell>
    );
  }

  if (!booking) {
    return (
      <PayCardShell>
        <div className={`${SECTION_CLASS} text-red-700`}>{error || "Booking not found"}</div>
      </PayCardShell>
    );
  }

  if (booking.authorizedAt || booking.status !== "PENDING") {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center text-gray-600">
        Redirecting to booking status...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:py-10">
      <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] ring-1 ring-gray-200/80">
        <div className={`${SECTION_CLASS} border-b border-gray-100 bg-gray-50/80`}>
          <div className="flex flex-col items-center gap-3">
            <Image
              src="/images/mercadopago-logo.png"
              alt="Mercado Pago"
              width={353}
              height={143}
              className="h-14 w-auto sm:h-16"
              priority
            />
            <p className="flex items-center gap-1.5 text-xs text-gray-600">
              <LockIcon className="h-3.5 w-3.5 shrink-0 text-[#009EE3]" />
              Pago seguro con Mercado Pago
            </p>
          </div>
        </div>

        <div className={`${SECTION_CLASS} space-y-3.5 border-b border-gray-100`}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">
              Resumen del pedido
            </p>
            <h1 className="mt-1 text-lg font-semibold leading-snug text-gray-900">
              {booking.listing.title}
            </h1>
          </div>
          <div className="flex items-baseline justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3.5">
            <span className="text-sm text-gray-600">Total a autorizar</span>
            <span className="text-xl font-semibold tabular-nums text-gray-900">{amountLabel}</span>
          </div>
          <AuthorizationNotice />
        </div>

        <div className={`${SECTION_CLASS} space-y-4`}>
          <div className="mp-pay-brick-host">
            <div className="relative min-h-[280px]">
              {!brickReady && <FormSkeleton />}
              <div
                id="mp-card-payment"
                className={brickReady ? "block" : "absolute inset-0 h-0 overflow-hidden opacity-0"}
              />
            </div>
          </div>

          {submitting && (
            <div className="flex items-center gap-2 rounded-lg bg-[#009EE3]/5 px-4 py-3 text-sm text-[#007EB5]">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#009EE3] border-t-transparent" />
              Autorizando pago...
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}
        </div>

        <div className={`${SECTION_CLASS} border-t border-gray-100 bg-gray-50/60`}>
          <div className="flex items-start gap-2.5 text-xs leading-relaxed text-gray-500">
            <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <p>
              Tus datos de pago se cifran y procesan directamente en Mercado Pago. Aldeitas no
              almacena tu número de tarjeta.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center">
        <Link
          href={`/listing/${booking.listing.id}`}
          className="text-sm text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline"
        >
          Cancelar y volver al alojamiento
        </Link>
      </p>
    </div>
  );
}
