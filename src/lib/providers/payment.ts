// Payment for items beyond the free quota and for home delivery.
// PAYMENT_PROVIDER picks one:
// - "mock" (default) shows a sample QR / card form and lets the tester mark it paid.
// - "omise" takes real payments through Omise (Opn Payments). Needs OMISE_PUBLIC_KEY and OMISE_SECRET_KEY;
//   test keys (pkey_test_/skey_test_) move no real money. See src/lib/payments.ts for how a charge settles.
import { createCharge } from "./omise";

export type PaymentMethodName = "PROMPTPAY" | "MOBILE_BANKING" | "CREDIT_CARD" | "DEBIT_CARD";

/** providerRef is empty when the charge is only created once the employee picks a bank or enters a card. */
export type PaymentSession = { providerRef?: string; promptPayPayload?: string };

export interface PaymentProvider {
  name: string;
  /** True when the tester can confirm payment from the app itself (no real money). */
  simulated: boolean;
  createSession(input: { paymentId: string; amount: number; method: PaymentMethodName }): Promise<PaymentSession>;
}

const mockProvider: PaymentProvider = {
  name: "mock",
  simulated: true,
  async createSession({ paymentId, amount, method }) {
    return {
      providerRef: `MOCK-${paymentId.slice(-8).toUpperCase()}`,
      promptPayPayload: method === "PROMPTPAY" ? `MOCK-PROMPTPAY|SONGSMAI|${amount.toFixed(2)}|${paymentId}` : undefined,
    };
  },
};

const omiseProvider: PaymentProvider = {
  name: "omise",
  simulated: false,
  async createSession({ paymentId, amount, method }) {
    // PromptPay needs no input from the employee, so the QR is created right away.
    if (method !== "PROMPTPAY") return {};
    const charge = await createCharge({ paymentId, amount, sourceType: "promptpay", description: `TTB uniform ${paymentId}` });
    return { providerRef: charge.id };
  },
};

export function payments(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER ?? "mock";
  switch (name) {
    case "mock":
      return mockProvider;
    case "omise":
      return omiseProvider;
    default:
      throw new Error(`Unknown PAYMENT_PROVIDER "${name}"`);
  }
}
