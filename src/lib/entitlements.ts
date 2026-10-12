// Pure entitlement and pricing logic, shared by the employee app and admin.

export type Gender = "MALE" | "FEMALE";

export type RuleLike = {
  productId: string;
  gender: Gender | null;
  department: string | null;
  position: string | null;
  quantity: number;
};

export type EmployeeLike = { gender: Gender; department: string; position: string };

export function ruleMatches(rule: RuleLike, emp: EmployeeLike): boolean {
  return (
    (rule.gender === null || rule.gender === emp.gender) &&
    (rule.department === null || rule.department === emp.department) &&
    (rule.position === null || rule.position === emp.position)
  );
}

/** productId -> free pieces per round. When several rules match a product, the most generous wins. */
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

export function priceLines(lines: LineInput[], entitled: Map<string, number>): PricedLine[] {
  return lines.map((l) => {
    const free = Math.min(l.quantity, entitled.get(l.productId) ?? 0);
    const extra = l.quantity - free;
    return { ...l, entitledQty: free, extraQty: extra, lineTotal: extra * l.unitPrice };
  });
}

export function orderTotals(lines: PricedLine[], deliveryFee: number) {
  const extrasTotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  return { extrasTotal, deliveryFee, total: extrasTotal + deliveryFee };
}

/** What still has to be paid (positive) or refunded (negative) after an edit. */
export function balanceDue(total: number, amountPaid: number): number {
  return total - amountPaid;
}
