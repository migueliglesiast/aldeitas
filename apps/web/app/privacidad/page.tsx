import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LegalContent } from "@/components/InfoPages";
import { getStorefrontFromHeaders } from "@/lib/storefront";
import { getPortalOrigin } from "@/lib/storefront-host";

export const metadata: Metadata = { title: "Aviso de privacidad" };

export default async function Page() {
  if (await getStorefrontFromHeaders()) redirect(`${getPortalOrigin()}/privacidad`);
  return <LegalContent doc="privacy" />;
}
