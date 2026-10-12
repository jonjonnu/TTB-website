// Payment for items beyond the free quota and for home delivery.
// The mock provider shows a sample PromptPay QR / card form and lets the tester mark it paid.
// To go live, implement PaymentProvider with a Thai gateway (e.g. Omise / Opn, 2C2P, GB Prime Pay)
// and select it with PAYMENT_PROVIDER. Its webhook should call markPaymentPaid().
export type PaymentMethodName = "PROMPTPAY" | "MOBILE_BANKING" | "CREDIT_CARD" | "DEBIT_CARD";

export type PaymentSession = { providerRef: string; promptPayPayload?: string };

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

export function payments(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER ?? "mock";
  switch (name) {
    case "mock":
      return mockProvider;
    default:
      throw new Error(`Unknown PAYMENT_PROVIDER "${name}"`);
  }
}
