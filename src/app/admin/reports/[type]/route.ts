import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { thDate } from "@/lib/format";
import { benefitFor, viewOf } from "@/lib/portal";
import { PAYMENT_LABEL, PAYMENT_METHOD_LABEL, STATUS_LABEL } from "@/lib/portal-labels";
import { currentAdmin } from "@/lib/session";
import { eligibleWhere } from "../../lib";

type Cell = string | number | null | undefined;
type Round = NonNullable<Awaited<ReturnType<typeof loadRound>>>;

const loadRound = (id: string) => db.orderRound.findUnique({ where: { id }, include: { extensions: true, policies: true } });
const fullName = (e: { firstName: string; lastName: string }) => `${e.firstName} ${e.lastName}`;

/** The 8 dashboard reports, as CSV for Excel. */
const REPORTS: Record<string, (round: Round) => Promise<Cell[][]>> = {
  // Who used their entitlement / credit, and who hasn't ordered.
  async usage(round) {
    const emps = await db.employee.findMany({
      where: eligibleWhere(round),
      include: { orders: { where: { roundId: round.id }, include: { items: true } } },
      orderBy: { employeeCode: "asc" },
    });
    return [
      ["employee_code", "name", "department", "position", "work_location", "benefit", "credit", "credit_used", "credit_left", "order_number", "pieces", "status"],
      ...emps.map((e) => {
        const b = benefitFor(round, e.department);
        const o = e.orders[0];
        return [
          e.employeeCode,
          fullName(e),
          e.department,
          e.position,
          e.workLocation,
          b.mode === "CREDIT" ? "credit" : "fixed",
          b.credit,
          o?.creditUsed ?? 0,
          b.mode === "CREDIT" ? b.credit - (o?.creditUsed ?? 0) : "",
          o?.orderNumber,
          o?.items.reduce((s, i) => s + i.quantity, 0) ?? 0,
          o ? STATUS_LABEL[o.status] : e.registeredAt ? "ยังไม่สั่ง" : "ยังไม่ลงทะเบียน",
        ];
      }),
    ];
  },
  // Orders where the employee paid on top of entitlement / credit.
  async extras(round) {
    const orders = await db.order.findMany({ where: { roundId: round.id, total: { gt: 0 } }, include: { employee: true }, orderBy: { orderNumber: "asc" } });
    return [
      ["order_number", "employee_code", "name", "department", "subtotal", "credit_used", "employee_pays", "paid", "payment_status", "payment_method"],
      ...orders.map((o) => [
        o.orderNumber,
        o.employee.employeeCode,
        fullName(o.employee),
        o.employee.department,
        o.subtotal,
        o.creditUsed,
        o.total,
        o.amountPaid,
        PAYMENT_LABEL[o.paymentStatus],
        o.paymentMethod ? PAYMENT_METHOD_LABEL[o.paymentMethod] : "",
      ]),
    ];
  },
  async department(round) {
    return groupReport(round, "department", "department");
  },
  async location(round) {
    return groupReport(round, "workLocation", "work_location");
  },
  // Total pieces to produce, by SKU / size / length.
  async production(round) {
    const items = await db.orderItem.findMany({
      where: { order: { roundId: round.id, status: { not: "CANCELLED" } } },
      include: { product: true },
    });
    const sum = new Map<string, { sku: string; name: string; size: string; length: string; qty: number }>();
    for (const i of items) {
      const key = [i.product.sku, i.size, i.length ?? ""].join("|");
      const row = sum.get(key) ?? { sku: i.product.sku, name: i.product.name, size: i.size, length: i.length ?? "", qty: 0 };
      row.qty += i.quantity;
      sum.set(key, row);
    }
    return [
      ["sku", "product", "size", "length", "quantity"],
      ...[...sum.values()].sort((a, b) => a.sku.localeCompare(b.sku) || a.size.localeCompare(b.size)).map((r) => [r.sku, r.name, r.size, r.length, r.qty]),
    ];
  },
  async shipping(round) {
    const orders = await db.order.findMany({
      where: { roundId: round.id, status: { not: "CANCELLED" } },
      include: { employee: true },
      orderBy: [{ employee: { workLocation: "asc" } }, { orderNumber: "asc" }],
    });
    return [
      ["order_number", "employee_code", "name", "phone", "work_location", "delivery_address", "carrier", "tracking_number", "status"],
      ...orders.map((o) => [
        o.orderNumber,
        o.employee.employeeCode,
        fullName(o.employee),
        o.employee.phone,
        o.employee.workLocation,
        o.deliveryAddress ?? o.employee.workAddress,
        o.carrier,
        o.trackingNumber,
        STATUS_LABEL[o.status],
      ]),
    ];
  },
  // Not yet delivered, with how far past the delivery promise each one is.
  async outstanding(round) {
    const due = viewOf(round).deliveryDue;
    const orders = await db.order.findMany({
      where: { roundId: round.id, status: { notIn: ["DELIVERED", "CANCELLED"] } },
      include: { employee: true, _count: { select: { items: true } } },
      orderBy: { orderNumber: "asc" },
    });
    const late = Math.max(0, Math.floor((Date.now() - due.getTime()) / 86_400_000));
    return [
      ["order_number", "employee_code", "name", "work_location", "items", "status", "tracking_number", "delivery_due", "days_late"],
      ...orders.map((o) => [o.orderNumber, o.employee.employeeCode, fullName(o.employee), o.employee.workLocation, o._count.items, STATUS_LABEL[o.status], o.trackingNumber, thDate(due), late]),
    ];
  },
  async stock(round) {
    const [products, ordered] = await Promise.all([
      db.product.findMany({ orderBy: { sortOrder: "asc" } }),
      db.orderItem.groupBy({ by: ["productId"], where: { order: { roundId: round.id, status: { not: "CANCELLED" } } }, _sum: { quantity: true } }),
    ]);
    return [
      ["sku", "product", "stock", "ordered_this_round", "remaining", "price", "credit_allowed", "personal_sale"],
      ...products.map((p) => {
        const q = ordered.find((o) => o.productId === p.id)?._sum.quantity ?? 0;
        return [p.sku, p.name, p.stock, q, p.stock - q, p.price, p.creditAllowed ? "yes" : "no", p.personalSale ? "yes" : "no"];
      }),
    ];
  },
};

async function groupReport(round: Round, field: "department" | "workLocation", header: string): Promise<Cell[][]> {
  const emps = await db.employee.findMany({
    where: eligibleWhere(round),
    select: { department: true, workLocation: true, orders: { where: { roundId: round.id }, select: { creditUsed: true, amountPaid: true, items: { select: { quantity: true } } } } },
  });
  const rows = new Map<string, { people: number; ordered: number; pieces: number; credit: number; paid: number }>();
  for (const e of emps) {
    const key = e[field] ?? "-";
    const r = rows.get(key) ?? { people: 0, ordered: 0, pieces: 0, credit: 0, paid: 0 };
    r.people++;
    for (const o of e.orders) {
      r.ordered++;
      r.pieces += o.items.reduce((s, i) => s + i.quantity, 0);
      r.credit += o.creditUsed;
      r.paid += o.amountPaid;
    }
    rows.set(key, r);
  }
  return [
    [header, "employees", "ordered", "ordered_pct", "pieces", "credit_used", "paid_by_employees"],
    ...[...rows].sort(([a], [b]) => a.localeCompare(b)).map(([k, r]) => [k, r.people, r.ordered, Math.round((r.ordered / r.people) * 100), r.pieces, r.credit, r.paid]),
  ];
}

export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
  if (!(await currentAdmin())) return new Response("Unauthorized", { status: 401 });
  const { type } = await params;
  const build = REPORTS[type];
  if (!build) return new Response("Unknown report", { status: 404 });
  const roundId = new URL(req.url).searchParams.get("round");
  const round = roundId ? await loadRound(roundId) : null;
  if (!round) return new Response("round is required", { status: 400 });
  const csv = toCsv(await build(round));
  const slug = round.name.replace(/[^\w-]+/g, "-").toLowerCase();
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ttb-${type}-${slug}.csv"` },
  });
}
