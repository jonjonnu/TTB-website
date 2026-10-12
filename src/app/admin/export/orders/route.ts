import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { STATUS_LABEL } from "@/lib/portal-labels";
import { currentAdmin } from "@/lib/session";

/** One row per order line, for Songsmai production, sorted by the round's packing group. */
export async function GET(req: Request) {
  if (!(await currentAdmin())) return new Response("Unauthorized", { status: 401 });
  const roundId = new URL(req.url).searchParams.get("round");
  if (!roundId) return new Response("round is required", { status: 400 });
  const round = await db.orderRound.findUnique({ where: { id: roundId } });
  if (!round) return new Response("Not found", { status: 404 });
  const orders = await db.order.findMany({
    where: { roundId, status: { not: "CANCELLED" } },
    include: { employee: true, items: { include: { product: true } } },
    orderBy: { orderNumber: "asc" },
  });
  const group = (o: (typeof orders)[number]) =>
    round.packing === "PER_DEPARTMENT"
      ? o.employee.department
      : round.packing === "PER_LOCATION"
        ? (o.employee.workLocation ?? "-")
        : o.orderNumber;
  orders.sort((a, b) => group(a).localeCompare(group(b)) || a.orderNumber.localeCompare(b.orderNumber));
  const csv = toCsv([
    ["pack_group", "order_number", "employee_code", "name", "department", "gender", "position", "sku", "product", "size", "length", "quantity", "entitled_qty", "priced_qty", "unit_price", "note", "work_location", "delivery_address", "status"],
    ...orders.flatMap((o) =>
      o.items.map((i) => [
        group(o),
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
        o.employee.workLocation,
        o.deliveryAddress ?? o.employee.workAddress,
        STATUS_LABEL[o.status],
      ]),
    ),
  ]);
  const slug = round.name.replace(/[^\w-]+/g, "-").toLowerCase();
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ttb-production-${slug}.csv"` },
  });
}
