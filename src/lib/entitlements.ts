// Pure entitlement, credit and pricing logic, shared by the employee app and admin.

export type Gender = "MALE" | "FEMALE";
export type BenefitMode = "FIXED" | "CREDIT";

const YEAR = 365.25 * 24 * 60 * 60 * 1000;

/** Whole years of service at `at`. */
export function yearsOfService(startDate: Date | null | undefined, at = new Date()): number {
  if (!startDate) return 0;
  return Math.max(0, Math.floor((at.getTime() - startDate.getTime()) / YEAR));
}

/** "3 ปี 4 เดือน" */
export function serviceLabel(startDate: Date | null | undefined, at = new Date()): string {
  if (!startDate) return "-";
  const months = Math.max(0, (at.getFullYear() - startDate.getFullYear()) * 12 + at.getMonth() - startDate.getMonth() - (at.getDate() < startDate.getDate() ? 1 : 0));
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y && `${y} ปี`, m && `${m} เดือน`].filter(Boolean).join(" ") || "น้อยกว่า 1 เดือน";
}

export type RuleLike = {
  productId: string;
  gender: Gender | null;
  department: string | null;
  position: string | null;
  minYears: number | null;
  quantity: number;
};

export type EmployeeLike = { gender: Gender; department: string; position: string; years: number };

export function ruleMatches(rule: RuleLike, emp: EmployeeLike): boolean {
  return (
    (rule.gender === null || rule.gender === emp.gender) &&
    (rule.department === null || rule.department === emp.department) &&
    (rule.position === null || rule.position === emp.position) &&
    (rule.minYears === null || emp.years >= rule.minYears)
  );
}

/**
 * productId -> free pieces per round. Matching groups combine (e.g. 5+ years adds a tie);
 * when several rules give the same product, the most generous wins.
 */
export function entitlementsFor(rules: RuleLike[], emp: EmployeeLike): Map<string, number> {
  const out = new Map<string, number>();
  for (const rule of rules) {
    if (!ruleMatches(rule, emp)) continue;
    out.set(rule.productId, Math.max(out.get(rule.productId) ?? 0, rule.quantity));
  }
  return out;
}

export type LineInput = { productId: string; quantity: number; unitPrice: number };
export type PricedLine = LineInput & { entitledQty: number; extraQty: number; lineTotal: number };

/** FIXED mode: pieces within the entitlement are free, the rest are priced. */
export function priceFixed(lines: LineInput[], entitled: Map<string, number>): PricedLine[] {
  return lines.map((l) => {
    const free = Math.min(l.quantity, entitled.get(l.productId) ?? 0);
    const extra = l.quantity - free;
    return { ...l, entitledQty: free, extraQty: extra, lineTotal: extra * l.unitPrice };
  });
}

/** CREDIT mode and personal orders: every piece is priced. */
export function priceAll(lines: LineInput[]): PricedLine[] {
  return lines.map((l) => ({ ...l, entitledQty: 0, extraQty: l.quantity, lineTotal: l.quantity * l.unitPrice }));
}

export type Totals = { subtotal: number; creditUsed: number; deliveryFee: number; total: number };

export function orderTotals(lines: PricedLine[], opts: { credit?: number; deliveryFee?: number } = {}): Totals {
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const creditUsed = Math.min(subtotal, Math.max(0, opts.credit ?? 0));
  const deliveryFee = opts.deliveryFee ?? 0;
  return { subtotal, creditUsed, deliveryFee, total: subtotal - creditUsed + deliveryFee };
}

/** What still has to be paid (positive) or refunded (negative) after an edit. */
export function balanceDue(total: number, amountPaid: number): number {
  return total - amountPaid;
}
