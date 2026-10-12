const TZ = "Asia/Bangkok";

export function baht(amount: number): string {
  return `฿${amount.toLocaleString("th-TH")}`;
}

/** 16 ต.ค. 2026 */
export function thDate(d: Date): string {
  return new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  }).format(d);
}

/** 16 ต.ค. 2026 23:59 */
export function thDateTime(d: Date): string {
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(d);
  return `${thDate(d)} ${time}`;
}

/** 10–16 ต.ค. */
export function thShortDate(d: Date): string {
  return new Intl.DateTimeFormat("th-TH-u-ca-gregory", { day: "numeric", month: "short", timeZone: TZ }).format(d);
}

/** Value for <input type="datetime-local"> in Bangkok time. */
export function toLocalInput(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TZ,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Parse a datetime-local value as Bangkok time (UTC+7, no DST). */
export function fromLocalInput(v: string): Date {
  return new Date(`${v}:00+07:00`);
}

export function maskPhone(phone?: string | null): string {
  if (!phone) return "-";
  const digits = phone.replace(/\D/g, "");
  return `${digits.slice(0, 2)}X-XXX-${digits.slice(-4)}`;
}

export function maskEmail(email?: string | null): string {
  if (!email) return "-";
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}•••••@${domain}`;
}

export function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`;
}
