import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireEmployee } from "@/lib/session";
import { canOrder, currentRound, pricedCart } from "@/lib/portal";
import { thDateTime } from "@/lib/format";
import { TopBar } from "@/components/ui";
import { CheckoutForm } from "./checkout-form";

export default async function CheckoutPage() {
  const emp = await requireEmployee();
  const view = await currentRound(emp.department);
  if (!view) redirect("/");
  const order = await db.order.findUnique({ where: { employeeId_roundId: { employeeId: emp.id, roundId: view.round.id } } });
  if (!canOrder(view, emp, !!order)) redirect(order ? `/orders/${order.id}` : "/");
  const { lines } = await pricedCart(emp, view.round.id);
  if (lines.length === 0) redirect("/");
  const branches = await db.branch.findMany({ orderBy: [{ region: "asc" }, { name: "asc" }] });

  return (
    <>
      <TopBar title={order ? "แก้ไขคำสั่งซื้อ" : "ตรวจสอบคำสั่งซื้อ"} back="/" />
      <CheckoutForm
        closeAtText={thDateTime(view.closeAt)}
        deliveryDays={view.round.deliveryDays}
        homeDeliveryFee={view.round.homeDeliveryFee}
        amountPaid={order?.amountPaid ?? 0}
        isEdit={!!order}
        lines={lines.map((l) => ({
          productId: l.productId,
          name: l.product.name,
          size: l.size,
          length: l.length,
          quantity: l.quantity,
          entitledQty: l.entitledQty,
          extraQty: l.extraQty,
          lineTotal: l.lineTotal,
        }))}
        branches={branches.map((b) => ({ id: b.id, label: `${b.name} · ${b.region}` }))}
        defaults={{
          deliveryMethod: order?.deliveryMethod ?? "BRANCH",
          branchId: order?.branchId ?? emp.branchId ?? "",
          homeAddress: order?.homeAddress ?? emp.homeAddress ?? "",
        }}
      />
    </>
  );
}
