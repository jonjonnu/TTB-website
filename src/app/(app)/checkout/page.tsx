import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireEmployee } from "@/lib/session";
import { canOrderWelfare, pricedWelfareCart, welfareRoundFor } from "@/lib/portal";
import { thDateTime } from "@/lib/format";
import { TopBar } from "@/components/ui";
import { CheckoutForm } from "./checkout-form";

export default async function CheckoutPage() {
  const emp = await requireEmployee();
  const view = await welfareRoundFor(emp);
  if (!view) redirect("/");
  const order = await db.order.findUnique({ where: { employeeId_roundId: { employeeId: emp.id, roundId: view.round.id } } });
  if (!canOrderWelfare(view, !!order)) redirect(order ? `/orders/${order.id}` : "/");
  const { lines, totals, benefit } = await pricedWelfareCart(emp, view);
  if (lines.length === 0) redirect("/");

  return (
    <>
      <TopBar title={`${order ? "แก้ไขคำสั่งซื้อ" : "ตรวจสอบคำสั่งซื้อ"} · ${view.round.name}`} back="/" />
      <CheckoutForm
        mode={benefit.mode}
        credit={benefit.credit}
        roundName={view.round.name}
        closeAtText={thDateTime(view.closeAt)}
        deliveryDays={view.round.deliveryDays}
        workLocation={emp.workLocation}
        workAddress={emp.workAddress}
        amountPaid={order?.amountPaid ?? 0}
        isEdit={!!order}
        totals={totals}
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
      />
    </>
  );
}
