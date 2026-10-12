import Link from "next/link";
import { db } from "@/lib/db";
import { thDate } from "@/lib/format";
import { canOrderWelfare, orderTitle, STATUS_LABEL, welfareRoundFor } from "@/lib/portal";
import { requireEmployee } from "@/lib/session";
import { Badge, Card } from "@/components/ui";
import { AppHeader } from "../app-header";

const tone = (s: string) =>
  (s === "DELIVERED" ? "ok" : s === "PLACED" ? "gray" : s === "CANCELLED" ? "bad" : "navy") as "ok" | "navy" | "bad" | "gray";

export default async function OrdersPage() {
  const emp = await requireEmployee();
  const [orders, view] = await Promise.all([
    db.order.findMany({
      where: { employeeId: emp.id },
      include: { items: { include: { product: true } }, round: true },
      orderBy: { createdAt: "desc" },
    }),
    welfareRoundFor(emp),
  ]);

  return (
    <>
      <AppHeader emp={emp} />
      <main className="space-y-3 px-4 py-4">
        <h2 className="text-xl font-medium">ประวัติคำสั่งซื้อ</h2>
        {orders.length === 0 && <Card className="p-4 text-sm text-muted">ยังไม่มีคำสั่งซื้อ</Card>}
        {orders.map((o) => {
          const editable = o.kind === "WELFARE" && view?.round.id === o.roundId && canOrderWelfare(view, true) && o.status === "PLACED";
          const after = o.status === "SHIPPING" || o.status === "DELIVERED";
          return (
            <Card key={o.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{orderTitle(o)}</p>
                <Badge tone={editable ? "gray" : tone(o.status)}>{editable ? "ยืนยันแล้ว · แก้ไขได้" : STATUS_LABEL[o.status]}</Badge>
              </div>
              <p className="text-xs text-muted">
                {o.orderNumber} · {thDate(o.createdAt)}
              </p>
              <p className="mt-1.5 text-sm">{o.items.map((i) => `${i.product.name} ${i.quantity}`).join(" · ")}</p>
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2 text-xs">
                <span className="text-muted">
                  {editable
                    ? `ปิดรอบ ${thDate(view!.closeAt)}`
                    : o.trackingNumber
                      ? `${o.carrier ?? "J&T"} ${o.trackingNumber}`
                      : o.kind === "PERSONAL"
                        ? `ส่งถึง${o.deliveryMethod === "HOME" ? "บ้าน" : "ที่ทำงาน"}`
                        : `อัปเดต ${thDate(o.updatedAt)}`}
                </span>
                <span className="flex shrink-0 gap-3">
                  {after && (
                    <Link href={`/orders/${o.id}/exchange`} className="font-medium text-navy">
                      เปลี่ยนสินค้า
                    </Link>
                  )}
                  <Link href={`/orders/${o.id}`} className="font-medium text-navy">
                    {editable ? "แก้ไข" : "รายละเอียด"}
                  </Link>
                </span>
              </div>
            </Card>
          );
        })}
      </main>
    </>
  );
}
