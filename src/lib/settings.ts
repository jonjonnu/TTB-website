import { db } from "@/lib/db";

// Standard timeline and fees (admin can change these).
export const DEFAULT_SETTINGS = {
  openDays: 7, // days a welfare round is open
  deliveryDays: 45, // days after close until delivery to the workplace
  homeDeliveryFee: 150, // personal orders shipped to home
  backOfficeCredit: 2000, // default credit for new rounds
};

export type Settings = typeof DEFAULT_SETTINGS;

export async function getSettings(): Promise<Settings> {
  const rows = await db.setting.findMany();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (r.key in out) out[r.key as keyof Settings] = Number(r.value);
  }
  return out;
}

export async function saveSettings(s: Partial<Settings>) {
  await db.$transaction(
    Object.entries(s).map(([key, value]) =>
      db.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } }),
    ),
  );
}
