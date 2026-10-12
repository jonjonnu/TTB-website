// Employee-side domain logic: current round, entitlements, cart, checkout.
import { db } from "@/lib/db";
import { entitlementsFor, orderTotals, priceLines } from "@/lib/entitlements";
import { deliveryDueAt, effectiveCloseAt, roundPhase } from "@/lib/rounds";
import type { Employee, OrderRound, RoundExtension } from "@prisma/client";

export type RoundView = {
  round: OrderRound & { extensions: RoundExtension[] };
  closeAt: Date;
  phase: "UPCOMING" | "OPEN" | "CLOSED";
  deliveryDue: Date;
  extended: boolean;
};

/** The round employees should see: the open one, else the next upcoming, else the latest. */
export async function currentRound(department?: string | null): Promise<RoundView | null> {
  const rounds = await db.orderRound.findMany({
    include: { extensions: true },
    orderBy: [{ opensAt: "desc" }],
    take: 6,
  });
  if (rounds.length === 0) return null;
  const now = new Date();
  const views = rounds.map((round) => {
    const closeAt = effectiveCloseAt(round, round.extensions, department);
    return {
      round,
      closeAt,
      phase: roundPhase(round, closeAt, now),
      deliveryDue: deliveryDueAt(closeAt, round.deliveryDays),
      extended: closeAt.getTime() !== round.originalClosesAt.getTime() && !round.closedEarlyAt,
    };
  });
  return (
    views.find((v) => v.phase === "OPEN") ??
    [...views].reverse().find((v) => v.phase === "UPCOMING") ??
    views[0]
  );
}

export async function employeeEntitlements(emp: Pick<Employee, "gender" | "department" | "position">) {
  const rules = await db.entitlementRule.findMany();
  return entitlementsFor(rules, emp);
}

/** Products this employee is entitled to, with what's in their cart/order for the round. */
export async function catalogFor(emp: Employee, roundId: string | null) {
  const [entitled, products, cart, order] = await Promise.all([
    employeeEntitlements(emp),
    db.product.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    roundId ? db.cartItem.findMany({ where: { employeeId: emp.id, roundId } }) : Promise.resolve([]),
    roundId
      ? db.order.findUnique({ where: { employeeId_roundId: { employeeId: emp.id, roundId } }, include: { items: true } })
      : Promise.resolve(null),
  ]);
  const cartBy = new Map(cart.map((c) => [c.productId, c]));
  return {
    order,
    cartCount: cart.length,
    entitledProducts: products
      .filter((p) => entitled.has(p.id))
      .map((p) => ({ product: p, entitled: entitled.get(p.id)!, cart: cartBy.get(p.id) ?? null })),
    extraProducts: products
      .filter((p) => !entitled.has(p.id))
      .map((p) => ({ product: p, entitled: 0, cart: cartBy.get(p.id) ?? null })),
    entitled,
  };
}

export async function pricedCart(emp: Employee, roundId: string) {
  const [entitled, cart] = await Promise.all([
    employeeEntitlements(emp),
    db.cartItem.findMany({
      where: { employeeId: emp.id, roundId },
      include: { product: true },
      orderBy: { product: { sortOrder: "asc" } },
    }),
  ]);
  const priced = priceLines(
    cart.map((c) => ({ productId: c.productId, quantity: c.quantity, unitPrice: c.product.price })),
    entitled,
  );
  return { entitled, lines: cart.map((c, i) => ({ ...c, ...priced[i] })) };
}

export function computeTotals(lines: { lineTotal: number; entitledQty: number; extraQty: number }[], deliveryFee: number) {
  const t = orderTotals(lines as Parameters<typeof orderTotals>[0], deliveryFee);
  return { ...t, freePieces: lines.reduce((s, l) => s + l.entitledQty, 0), extraPieces: lines.reduce((s, l) => s + l.extraQty, 0) };
}

export function canOrder(view: RoundView | null, emp: Employee, hasOrder: boolean) {
  if (!view || view.phase !== "OPEN") return false;
  return hasOrder ? view.round.allowEdits : true;
}

export async function nextOrderNumber(round: OrderRound) {
  const count = await db.order.count({ where: { roundId: round.id } });
  return `TTB-${round.year}-${round.roundNumber}-${String(count + 1).padStart(4, "0")}`;
}

export const STATUS_STEPS = [
  { status: "PLACED", label: "สั่งคำสั่งซื้อแล้ว" },
  { status: "ROUND_CLOSED", label: "ปิดรอบสั่งซื้อ" },
  { status: "REVIEWING", label: "ตรวจสอบคำสั่งซื้อ" },
  { status: "PRODUCING", label: "กำลังตัดเย็บ" },
  { status: "SHIPPED", label: "จัดส่งแล้ว" },
  { status: "DELIVERED", label: "ได้รับสินค้าแล้ว" },
] as const;

export const STATUS_LABEL: Record<string, string> = {
  ...Object.fromEntries(STATUS_STEPS.map((s) => [s.status, s.label])),
  CANCELLED: "ยกเลิก",
};

export const PAYMENT_LABEL: Record<string, string> = {
  NOT_REQUIRED: "ไม่มีค่าใช้จ่าย",
  PENDING: "รอชำระเงิน",
  PAID: "ชำระแล้ว",
  REFUND_DUE: "รอคืนเงินส่วนต่าง",
};
