import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LegalContent } from "@/components/InfoPages";
import { getStorefrontFromHeaders } from "@/lib/storefront";
import { getPortalOrigin } from "@/lib/storefront-host";

export const metadata: Metadata = { title: "Términos de uso" };

export default async function Page() {
  if (await getStorefrontFromHeaders()) redirect(`${getPortalOrigin()}/terminos`);
  return <LegalContent doc="terms" />;
}
