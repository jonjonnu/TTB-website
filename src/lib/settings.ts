import { db } from "@/lib/db";

// Standard timeline used when creating a new round (admin can change these).
export const DEFAULT_SETTINGS = {
  openDays: 7,
  deliveryDays: 45,
  homeDeliveryFee: 150,
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

export async function saveSettings(s: Settings) {
  await db.$transaction(
    Object.entries(s).map(([key, value]) =>
      db.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } }),
    ),
  );
}
