// Where OTP codes and notifications are sent. Only the mock provider exists today:
// it records every message in the OutboundMessage table instead of sending it.
// To go live, add a provider (e.g. ThaiBulkSMS for SMS, Resend for email) that
// implements MessagingProvider and select it with OTP_PROVIDER.
import { db } from "@/lib/db";

export type OutboundChannel = "SMS" | "EMAIL" | "LINE";

export interface MessagingProvider {
  name: string;
  send(msg: { channel: OutboundChannel; to: string; subject?: string; body: string }): Promise<void>;
}

const mockProvider: MessagingProvider = {
  name: "mock",
  async send(msg) {
    await db.outboundMessage.create({ data: { ...msg, provider: "mock" } });
    console.log(`[mock ${msg.channel}] to ${msg.to}: ${msg.body}`);
  },
};

export function messaging(): MessagingProvider {
  const name = process.env.OTP_PROVIDER ?? "mock";
  switch (name) {
    case "mock":
      return mockProvider;
    default:
      throw new Error(`Unknown OTP_PROVIDER "${name}"`);
  }
}
