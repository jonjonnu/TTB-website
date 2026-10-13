// Omise (Opn Payments) REST client: https://docs.opn.ooo
// Uses the secret key on the server only. Amounts in the app are whole baht; Omise wants satang.
// OMISE_API_URL is only for local testing against a fake server.
const omiseApi = () => process.env.OMISE_API_URL ?? "https://api.omise.co";

export const OMISE_BANKS = [
  { type: "mobile_banking_kbank", label: "K PLUS (กสิกรไทย)" },
  { type: "mobile_banking_scb", label: "SCB EASY (ไทยพาณิชย์)" },
  { type: "mobile_banking_bbl", label: "Bualuang mBanking (กรุงเทพ)" },
  { type: "mobile_banking_bay", label: "KMA (กรุงศรี)" },
  { type: "mobile_banking_ktb", label: "Krungthai NEXT (กรุงไทย)" },
] as const;
export type OmiseBank = (typeof OMISE_BANKS)[number]["type"];

export type OmiseCharge = {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "successful" | "failed" | "expired" | "reversed";
  paid: boolean;
  authorize_uri: string | null;
  failure_message: string | null;
  metadata: Record<string, string> | null;
  source: { type: string; scannable_code?: { image?: { download_uri?: string } } } | null;
};

export type ChargeInput = {
  paymentId: string;
  amount: number;
  returnUri?: string;
  description?: string;
} & ({ sourceType: "promptpay" | OmiseBank } | { cardToken: string });

function secretKey() {
  const key = process.env.OMISE_SECRET_KEY;
  if (!key) throw new Error("OMISE_SECRET_KEY is not set");
  return key;
}

async function call<T>(path: string, init?: { method: "POST"; body: URLSearchParams }): Promise<T> {
  const res = await fetch(omiseApi() + path, {
    method: init?.method ?? "GET",
    body: init?.body,
    headers: { Authorization: "Basic " + Buffer.from(secretKey() + ":").toString("base64") },
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || json.object === "error") throw new Error(`Omise ${json.code ?? res.status}: ${json.message ?? "request failed"}`);
  return json as T;
}

export function createCharge(input: ChargeInput) {
  const body = new URLSearchParams({
    amount: String(Math.round(input.amount * 100)),
    currency: "thb",
    "metadata[paymentId]": input.paymentId,
  });
  if (input.description) body.set("description", input.description);
  if (input.returnUri) body.set("return_uri", input.returnUri);
  if ("cardToken" in input) body.set("card", input.cardToken);
  else body.set("source[type]", input.sourceType);
  return call<OmiseCharge>("/charges", { method: "POST", body });
}

export async function getCharge(id: string) {
  if (!/^chrg_[a-zA-Z0-9_]+$/.test(id)) throw new Error("Invalid charge id");
  return call<OmiseCharge>(`/charges/${id}`);
}

/** The charge pays for this payment record in full. */
export function chargeMatches(charge: OmiseCharge, payment: { id: string; amount: number }) {
  return charge.metadata?.paymentId === payment.id && charge.currency.toLowerCase() === "thb" && charge.amount === payment.amount * 100;
}
