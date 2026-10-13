// Employee-side domain logic: which welfare round applies, benefit mode, catalogs, carts.
import { db } from "@/lib/db";
import { entitlementsFor, orderTotals, priceAll, priceFixed, yearsOfService, type BenefitMode } from "@/lib/entitlements";
import { deliveryDueAt, effectiveCloseAt, roundPhase } from "@/lib/rounds";
import type { Employee, OrderRound, Prisma, Product, RoundExtension, RoundPolicy } from "@prisma/client";

export type RoundWithRules = OrderRound & { extensions: RoundExtension[]; policies: RoundPolicy[] };

export type RoundView = {
  round: RoundWithRules;
  closeAt: Date;
  phase: "UPCOMING" | "OPEN" | "CLOSED";
  deliveryDue: Date;
  extended: boolean;
};

export function viewOf(round: RoundWithRules, emp?: Pick<Employee, "id" | "department"> | null, now = new Date()): RoundView {
  const closeAt = effectiveCloseAt(round, round.extensions, emp ?? undefined);
  return {
    round,
    closeAt,
    phase: roundPhase(round, closeAt, now),
    deliveryDue: deliveryDueAt(closeAt, round.deliveryDays),
    extended: closeAt.getTime() !== round.originalClosesAt.getTime() && !round.closedEarlyAt,
  };
}

const roundInclude = { extensions: true, policies: true } satisfies Prisma.OrderRoundInclude;

/**
 * The welfare round this employee should see: an open New Joiners round they were picked for,
 * else the open Big Lot, else the next upcoming one, else the most recent.
 * Without an employee (login page, admin) only Big Lot rounds are considered.
 */
export async function welfareRoundFor(emp?: Pick<Employee, "id" | "department"> | null): Promise<RoundView | null> {
  const rounds = await db.orderRound.findMany({
    where: emp
      ? { OR: [{ type: "BIG_LOT" }, { type: "NEW_JOINERS", members: { some: { employeeId: emp.id } } }] }
      : { type: "BIG_LOT" },
    include: roundInclude,
    orderBy: { opensAt: "desc" },
    take: 12,
  });
  if (rounds.length === 0) return null;
  const views = rounds.map((r) => viewOf(r, emp));
  const open = views.filter((v) => v.phase === "OPEN");
  return (
    open.find((v) => v.round.type === "NEW_JOINERS") ??
    open[0] ??
    [...views].reverse().find((v) => v.phase === "UPCOMING") ??
    views[0]
  );
}

/** Latest Big Lot, for admin screens. */
export async function latestBigLot() {
  const r = await db.orderRound.findFirst({ where: { type: "BIG_LOT" }, include: roundInclude, orderBy: { opensAt: "desc" } });
  return r ? viewOf(r) : null;
}

export type Benefit = { mode: BenefitMode; credit: number };

/** Department policy for a round. The round's credit switch turns credit off for everyone. */
export function benefitFor(round: RoundWithRules, department: string): Benefit {
  const p = round.policies.find((x) => x.department === department);
  if (!p || p.mode === "FIXED" || !round.creditEnabled) return { mode: "FIXED", credit: 0 };
  return { mode: "CREDIT", credit: p.creditAmount };
}

export async function employeeEntitlements(emp: Pick<Employee, "gender" | "department" | "position" | "startDate">, at = new Date()) {
  const rules = await db.entitlementRule.findMany();
  return entitlementsFor(rules, { ...emp, years: yearsOfService(emp.startDate, at) });
}

/** A product the employee's department can order in a welfare round (with credit, or paid on top of their set). */
export function inDepartmentCatalog(p: Pick<Product, "active" | "creditAllowed" | "departments">, department: string) {
  return p.active && p.creditAllowed && (p.departments.length === 0 || p.departments.includes(department));
}

/** Products shown on the welfare home page, with what's in the cart / order. */
export async function welfareCatalog(emp: Employee, view: RoundView | null) {
  const roundId = view?.round.id ?? null;
  const benefit = view ? benefitFor(view.round, emp.department) : ({ mode: "FIXED", credit: 0 } as Benefit);
  const [entitled, products, genderRules, cart, order] = await Promise.all([
    employeeEntitlements(emp, view?.round.opensAt),
    db.product.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.entitlementRule.findMany({ select: { productId: true, gender: true } }),
    roundId ? db.cartItem.findMany({ where: { employeeId: emp.id, kind: "WELFARE", roundId } }) : Promise.resolve([]),
    roundId
      ? db.order.findUnique({ where: { employeeId_roundId: { employeeId: emp.id, roundId } }, include: { items: true } })
      : Promise.resolve(null),
  ]);
  const cartBy = new Map(cart.map((c) => [c.productId, c]));
  // Hide items whose entitlement rules are all for the other gender (e.g. skirts for men).
  const otherGenderOnly = (id: string) => {
    const rs = genderRules.filter((r) => r.productId === id);
    return rs.length > 0 && rs.every((r) => r.gender && r.gender !== emp.gender);
  };
  const extra = (p: Product) => inDepartmentCatalog(p, emp.department) && !otherGenderOnly(p.id);
  // FIXED: their set first, then other department items they can add and pay for.
  const visible =
    benefit.mode === "CREDIT"
      ? products.filter(extra)
      : [...products.filter((p) => entitled.has(p.id)), ...products.filter((p) => !entitled.has(p.id) && extra(p))];
  return {
    benefit,
    order,
    cartCount: cart.length,
    entitled,
    items: visible.map((p) => ({ product: p, entitled: entitled.get(p.id) ?? 0, cart: cartBy.get(p.id) ?? null })),
  };
}

export async function pricedWelfareCart(emp: Employee, view: RoundView) {
  const benefit = benefitFor(view.round, emp.department);
  const [entitled, cart] = await Promise.all([
    employeeEntitlements(emp, view.round.opensAt),
    db.cartItem.findMany({
      where: { employeeId: emp.id, kind: "WELFARE", roundId: view.round.id },
      include: { product: true },
      orderBy: { product: { sortOrder: "asc" } },
    }),
  ]);
  const input = cart.map((c) => ({ productId: c.productId, quantity: c.quantity, unitPrice: c.product.price }));
  const priced = benefit.mode === "CREDIT" ? priceAll(input) : priceFixed(input, entitled);
  const lines = cart.map((c, i) => ({ ...c, ...priced[i] }));
  return { benefit, entitled, lines, totals: orderTotals(priced, { credit: benefit.credit }) };
}

export async function pricedPersonalCart(emp: Employee, deliveryFee = 0) {
  const cart = await db.cartItem.findMany({
    where: { employeeId: emp.id, kind: "PERSONAL" },
    include: { product: true },
    orderBy: { updatedAt: "asc" },
  });
  const priced = priceAll(cart.map((c) => ({ productId: c.productId, quantity: c.quantity, unitPrice: c.product.price })));
  return { lines: cart.map((c, i) => ({ ...c, ...priced[i] })), totals: orderTotals(priced, { deliveryFee }) };
}

export function canOrderWelfare(view: RoundView | null, hasOrder: boolean) {
  if (!view || view.phase !== "OPEN") return false;
  return hasOrder ? view.round.allowEdits : true;
}

export async function nextOrderNumber(kind: "WELFARE" | "PERSONAL", round?: OrderRound | null) {
  const prefix =
    kind === "PERSONAL" ? "PO-" : `${round!.type === "BIG_LOT" ? "BL" : "NJ"}${String(round!.year).slice(-2)}-`;
  // One atomic counter row per prefix, so two people checking out at the same moment never get the same number.
  // The first number for a prefix continues from orders already in the database.
  const [{ value }] = await db.$queryRaw<{ value: number }[]>`
    INSERT INTO "OrderCounter" (prefix, value)
    VALUES (${prefix}, (SELECT count(*)::int + 1 FROM "Order" WHERE "orderNumber" LIKE ${prefix + "%"}))
    ON CONFLICT (prefix) DO UPDATE SET value = "OrderCounter".value + 1
    RETURNING value`;
  return `${prefix}${String(value).padStart(4, "0")}`;
}

export * from "@/lib/portal-labels";
