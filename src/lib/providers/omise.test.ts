import { afterEach, describe, expect, it, vi } from "vitest";
import { chargeMatches, createCharge, getCharge, type OmiseCharge } from "./omise";

const charge = (over: Partial<OmiseCharge> = {}): OmiseCharge => ({
  id: "chrg_test_1",
  amount: 33000,
  currency: "thb",
  status: "pending",
  paid: false,
  authorize_uri: null,
  failure_message: null,
  metadata: { paymentId: "pay1" },
  source: null,
  ...over,
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function stubFetch(body: unknown, status = 200) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetch);
  vi.stubEnv("OMISE_SECRET_KEY", "skey_test_abc");
  return fetch;
}

describe("omise", () => {
  it("creates a PromptPay charge in satang with the payment id", async () => {
    const fetch = stubFetch(charge());
    await createCharge({ paymentId: "pay1", amount: 330, sourceType: "promptpay" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.omise.co/charges");
    const body = init.body as URLSearchParams;
    expect(body.get("amount")).toBe("33000");
    expect(body.get("currency")).toBe("thb");
    expect(body.get("source[type]")).toBe("promptpay");
    expect(body.get("metadata[paymentId]")).toBe("pay1");
    expect((init.headers as Record<string, string>).Authorization).toBe("Basic " + Buffer.from("skey_test_abc:").toString("base64"));
  });

  it("sends the card token and return address for cards", async () => {
    const fetch = stubFetch(charge());
    await createCharge({ paymentId: "pay1", amount: 330, cardToken: "tokn_test_1", returnUri: "https://x/pay/pay1/return" });
    const body = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams;
    expect(body.get("card")).toBe("tokn_test_1");
    expect(body.get("return_uri")).toBe("https://x/pay/pay1/return");
    expect(body.has("source[type]")).toBe(false);
  });

  it("raises Omise errors", async () => {
    stubFetch({ object: "error", code: "authentication_failure", message: "authentication failed" }, 401);
    await expect(getCharge("chrg_test_1")).rejects.toThrow("authentication_failure");
  });

  it("refuses odd charge ids", async () => {
    stubFetch(charge());
    await expect(getCharge("../account")).rejects.toThrow("Invalid charge id");
  });

  it("only accepts a charge for the same payment and full amount", () => {
    expect(chargeMatches(charge(), { id: "pay1", amount: 330 })).toBe(true);
    expect(chargeMatches(charge(), { id: "pay2", amount: 330 })).toBe(false);
    expect(chargeMatches(charge({ amount: 100 }), { id: "pay1", amount: 330 })).toBe(false);
  });
});
