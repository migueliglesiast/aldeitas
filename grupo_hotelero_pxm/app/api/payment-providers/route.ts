import { NextResponse } from "next/server";
import { getConfiguredPaymentProviders } from "@/lib/payment-providers/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    providers: getConfiguredPaymentProviders(),
  });
}
