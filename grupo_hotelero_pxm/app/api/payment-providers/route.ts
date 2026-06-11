import { NextResponse } from "next/server";
import { getConfiguredPaymentProviders } from "@/lib/payment-providers/config";

export async function GET() {
  return NextResponse.json({
    providers: getConfiguredPaymentProviders(),
  });
}
