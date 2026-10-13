import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { settleOmiseCharge } from "@/lib/payments";

// Omise sends the employee here after the bank app or card 3-D Secure step.
// The status is always re-checked with Omise, so opening this link by hand changes nothing.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payment = await db.payment.findUnique({ where: { id } });
  if (!payment) return NextResponse.redirect(new URL("/orders", req.url));
  if (payment.status !== "PAID" && payment.provider === "omise" && payment.providerRef) {
    const result = await settleOmiseCharge(payment.providerRef).catch((e) => {
      console.error(e);
      return null;
    });
    if (result?.state === "failed") return NextResponse.redirect(new URL(`/pay/${id}?failed=1`, req.url));
    if (result?.state !== "paid") return NextResponse.redirect(new URL(`/pay/${id}`, req.url));
  }
  return NextResponse.redirect(new URL(`/orders/${payment.orderId}?done=1`, req.url));
}
