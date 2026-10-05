import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HelpContent } from "@/components/InfoPages";
import { getStorefrontFromHeaders } from "@/lib/storefront";
import { getPortalOrigin } from "@/lib/storefront-host";

export const metadata: Metadata = { title: "Ayuda y contacto" };

export default async function Page() {
  if (await getStorefrontFromHeaders()) redirect(`${getPortalOrigin()}/ayuda`);
  return <HelpContent />;
}
