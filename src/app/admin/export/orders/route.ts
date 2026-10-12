import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { STATUS_LABEL } from "@/lib/portal";
import { currentAdmin } from "@/lib/session";

/** One row per order line, for Songsmai production. */
export async function GET(req: Request) {
  if (!(await currentAdmin())) return new Response("Unauthorized", { status: 401 });
  const roundId = new URL(req.url).searchParams.get("round");
  if (!roundId) return new Response("round is required", { status: 400 });
  const round = await db.orderRound.findUnique({ where: { id: roundId } });
  if (!round) return new Response("Not found", { status: 404 });
  const orders = await db.order.findMany({
    where: { roundId },
    include: { employee: true, branch: true, items: { include: { product: true } } },
    orderBy: { orderNumber: "asc" },
  });
  const csv = toCsv([
    ["order_number", "employee_code", "name", "department", "gender", "position", "sku", "product", "size", "length", "quantity", "free_qty", "paid_qty", "unit_price", "note", "delivery", "branch_or_address", "payment_status", "status"],
    ...orders.flatMap((o) =>
      o.items.map((i) => [
        o.orderNumber,
        o.employee.employeeCode,
        `${o.employee.firstName} ${o.employee.lastName}`,
        o.employee.department,
        o.employee.gender === "FEMALE" ? "F" : "M",
        o.employee.position,
        i.product.sku,
        i.product.name,
        i.size,
        i.length,
        i.quantity,
        i.entitledQty,
        i.extraQty,
        i.unitPrice,
        i.note,
        o.deliveryMethod === "HOME" ? "home" : "branch",
        o.deliveryMethod === "HOME" ? o.homeAddress : o.branch?.name,
        o.paymentStatus,
        STATUS_LABEL[o.status],
      ]),
    ),
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ttb-orders-${round.year}-${round.roundNumber}.csv"`,
    },
  });
}
