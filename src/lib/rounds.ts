// Pure helpers for a welfare round's timeline:
// open for N days -> closed, produced -> delivered to the workplace within 45 days of closing.

export const DAY = 24 * 60 * 60 * 1000;

export type RoundLike = {
  opensAt: Date;
  closesAt: Date;
  originalClosesAt: Date;
  deliveryDays: number;
  closedEarlyAt: Date | null;
};

export type ExtensionLike = {
  scope: "ALL" | "DEPARTMENT" | "EMPLOYEES";
  department: string | null;
  employeeIds: string[];
  newClosesAt: Date;
};

export type RoundPhase = "UPCOMING" | "OPEN" | "CLOSED";

/** Close time that applies to one employee, including department or individual extensions. */
export function effectiveCloseAt(
  round: RoundLike,
  extensions: ExtensionLike[],
  who?: { id?: string; department?: string | null },
): Date {
  if (round.closedEarlyAt) return round.closedEarlyAt;
  let close = round.closesAt;
  for (const ext of extensions) {
    const applies =
      (ext.scope === "DEPARTMENT" && !!who?.department && ext.department === who.department) ||
      (ext.scope === "EMPLOYEES" && !!who?.id && ext.employeeIds.includes(who.id));
    if (applies && ext.newClosesAt > close) close = ext.newClosesAt;
  }
  return close;
}

export function roundPhase(round: RoundLike, closeAt: Date, now = new Date()): RoundPhase {
  if (now < round.opensAt) return "UPCOMING";
  if (now < closeAt) return "OPEN";
  return "CLOSED";
}

export function deliveryDueAt(closeAt: Date, deliveryDays: number): Date {
  return new Date(closeAt.getTime() + deliveryDays * DAY);
}

export function daysLeft(closeAt: Date, now = new Date()): number {
  return Math.max(0, Math.ceil((closeAt.getTime() - now.getTime()) / DAY));
}
