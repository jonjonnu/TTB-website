import { describe, expect, it } from "vitest";
import { balanceDue, entitlementsFor, orderTotals, priceAll, priceFixed, yearsOfService, type RuleLike } from "./entitlements";

const rules: RuleLike[] = [
  { productId: "jacket", gender: "FEMALE", department: "Branch", position: null, minYears: null, quantity: 1 },
  { productId: "skirt", gender: "FEMALE", department: "Branch", position: null, minYears: null, quantity: 2 },
  { productId: "shirt", gender: null, department: "Branch", position: null, minYears: null, quantity: 3 },
  { productId: "shirt", gender: null, department: "Branch", position: "ผู้จัดการสาขา", minYears: null, quantity: 5 },
  { productId: "tie", gender: null, department: "Branch", position: null, minYears: 5, quantity: 1 },
];

describe("entitlementsFor", () => {
  it("applies gender and department filters", () => {
    const e = entitlementsFor(rules, { gender: "FEMALE", department: "Branch", position: "เจ้าหน้าที่", years: 2 });
    expect(Object.fromEntries(e)).toEqual({ jacket: 1, skirt: 2, shirt: 3 });
  });
  it("adds items for years of service", () => {
    const e = entitlementsFor(rules, { gender: "MALE", department: "Branch", position: "เจ้าหน้าที่", years: 6 });
    expect(Object.fromEntries(e)).toEqual({ shirt: 3, tie: 1 });
  });
  it("takes the most generous rule for a product", () => {
    const e = entitlementsFor(rules, { gender: "MALE", department: "Branch", position: "ผู้จัดการสาขา", years: 1 });
    expect(e.get("shirt")).toBe(5);
  });
  it("gives nothing to other departments", () => {
    expect(entitlementsFor(rules, { gender: "FEMALE", department: "Back Office", position: "x", years: 9 }).size).toBe(0);
  });
});

describe("pricing", () => {
  it("fixed mode charges only pieces beyond the entitlement", () => {
    const lines = priceFixed(
      [
        { productId: "jacket", quantity: 2, unitPrice: 1200 },
        { productId: "shirt", quantity: 3, unitPrice: 450 },
      ],
      new Map([
        ["jacket", 1],
        ["shirt", 3],
      ]),
    );
    expect(lines.map((l) => [l.entitledQty, l.extraQty])).toEqual([[1, 1], [3, 0]]);
    expect(orderTotals(lines)).toEqual({ subtotal: 1200, creditUsed: 0, deliveryFee: 0, total: 1200 });
  });
  it("credit mode uses credit first and charges the overage", () => {
    const lines = priceAll([
      { productId: "shirt", quantity: 2, unitPrice: 550 },
      { productId: "polo", quantity: 1, unitPrice: 450 },
      { productId: "cardigan", quantity: 1, unitPrice: 850 },
    ]);
    expect(orderTotals(lines, { credit: 2000 })).toEqual({ subtotal: 2400, creditUsed: 2000, deliveryFee: 0, total: 400 });
    expect(orderTotals(priceAll([{ productId: "polo", quantity: 1, unitPrice: 450 }]), { credit: 2000 }).total).toBe(0);
  });
  it("personal orders pay full price plus home delivery", () => {
    expect(orderTotals(priceAll([{ productId: "dress", quantity: 1, unitPrice: 1290 }]), { deliveryFee: 150 }).total).toBe(1440);
  });
  it("reports a balance after an edit", () => {
    expect(balanceDue(1650, 1200)).toBe(450);
    expect(balanceDue(1000, 1200)).toBe(-200);
  });
  it("counts whole years of service", () => {
    expect(yearsOfService(new Date("2021-06-01"), new Date("2026-10-12"))).toBe(5);
    expect(yearsOfService(new Date("2021-11-01"), new Date("2026-10-12"))).toBe(4);
  });
});
