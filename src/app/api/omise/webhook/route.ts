import { NextResponse } from "next/server";
import { settleOmiseCharge } from "@/lib/payments";

// Set this URL in the Omise dashboard (Webhooks): https://<your-site>/api/omise/webhook
// The body only tells us which charge changed; its status is fetched from Omise with the secret key.
export async function POST(req: Request) {
  const event = await req.json().catch(() => null);
  const charge = event?.data;
  if (event?.object !== "event" || charge?.object !== "charge" || typeof charge.id !== "string") {
    return NextResponse.json({ ok: true, ignored: true });
  }
  try {
    const result = await settleOmiseCharge(charge.id);
    return NextResponse.json({ ok: true, state: result.state });
  } catch (e) {
    // Not a charge this account can see (or a made-up id): nothing to retry.
    if (e instanceof Error && /not_found|Invalid charge id/.test(e.message)) return NextResponse.json({ ok: true, ignored: true });
    console.error("Omise webhook", e);
    // A 5xx makes Omise retry later.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
