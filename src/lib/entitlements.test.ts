import { describe, expect, it } from "vitest";
import { balanceDue, entitlementsFor, orderTotals, priceLines, type RuleLike } from "./entitlements";

const rules: RuleLike[] = [
  { productId: "jacket", gender: "FEMALE", department: null, position: null, quantity: 1 },
  { productId: "skirt", gender: "FEMALE", department: "สาขา", position: null, quantity: 2 },
  { productId: "shirt", gender: null, department: null, position: null, quantity: 3 },
  { productId: "shirt", gender: null, department: null, position: "ผู้จัดการสาขา", quantity: 5 },
];

describe("entitlementsFor", () => {
  it("applies gender and department filters", () => {
    const e = entitlementsFor(rules, { gender: "FEMALE", department: "สาขา", position: "เจ้าหน้าที่" });
    expect(Object.fromEntries(e)).toEqual({ jacket: 1, skirt: 2, shirt: 3 });
  });
  it("excludes rules for the other gender", () => {
    const e = entitlementsFor(rules, { gender: "MALE", department: "สาขา", position: "เจ้าหน้าที่" });
    expect(Object.fromEntries(e)).toEqual({ shirt: 3 });
  });
  it("takes the most generous rule for a product", () => {
    const e = entitlementsFor(rules, { gender: "MALE", department: "สำนักงานใหญ่", position: "ผู้จัดการสาขา" });
    expect(e.get("shirt")).toBe(5);
  });
});

describe("pricing", () => {
  it("charges only pieces beyond the entitlement, plus delivery", () => {
    const lines = priceLines(
      [
        { productId: "jacket", quantity: 2, unitPrice: 1200 },
        { productId: "shirt", quantity: 3, unitPrice: 450 },
        { productId: "tie", quantity: 1, unitPrice: 300 },
      ],
      new Map([
        ["jacket", 1],
        ["shirt", 3],
      ]),
    );
    expect(lines.map((l) => [l.entitledQty, l.extraQty])).toEqual([[1, 1], [3, 0], [0, 1]]);
    expect(orderTotals(lines, 150)).toEqual({ extrasTotal: 1500, deliveryFee: 150, total: 1650 });
  });
  it("reports a balance after an edit", () => {
    expect(balanceDue(1650, 1200)).toBe(450);
    expect(balanceDue(1000, 1200)).toBe(-200);
  });
});
