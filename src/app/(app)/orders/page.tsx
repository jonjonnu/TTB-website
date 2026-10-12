import Link from "next/link";
import { db } from "@/lib/db";
import { thDate } from "@/lib/format";
import { canOrder, currentRound, STATUS_LABEL } from "@/lib/portal";
import { roundLabel } from "@/lib/rounds";
import { requireEmployee } from "@/lib/session";
import { Badge, Card } from "@/components/ui";
import { AppHeader } from "../app-header";

const tone = (s: string) => (s === "DELIVERED" ? "ok" : s === "PLACED" ? "navy" : s === "CANCELLED" ? "bad" : "accent") as "ok" | "navy" | "bad" | "accent";

export default async function OrdersPage() {
  const emp = await requireEmployee();
  const [orders, rounds, view] = await Promise.all([
    db.order.findMany({
      where: { employeeId: emp.id },
      include: { items: { include: { product: true } }, round: true },
      orderBy: { createdAt: "desc" },
    }),
    db.orderRound.findMany({ where: { opensAt: { lte: new Date() } }, orderBy: { opensAt: "desc" }, take: 8 }),
    currentRound(emp.department),
  ]);
  const byRound = new Map(orders.map((o) => [o.roundId, o]));

  return (
    <>
      <AppHeader emp={emp} />
      <main className="space-y-3 px-4 py-4">
        <h2 className="text-xl font-bold">ประวัติคำสั่งซื้อ</h2>
        {rounds.length === 0 && <Card className="p-4 text-sm text-muted">ยังไม่มีประวัติ</Card>}
        {rounds.map((r) => {
          const o = byRound.get(r.id);
          const editable = o && view?.round.id === r.id && canOrder(view, emp, true) && o.status === "PLACED";
          return (
            <Card key={r.id} className="p-3">
              <div className="flex items-start justify-between">
                <p className="font-semibold">{roundLabel(r)}</p>
                {o ? (
                  <Badge tone={editable ? "navy" : tone(o.status)}>
                    {editable ? "สั่งแล้ว · แก้ไขได้" : STATUS_LABEL[o.status]}
                  </Badge>
                ) : (
                  <Badge tone="gray">ไม่ได้สั่ง</Badge>
                )}
              </div>
              {o ? (
                <>
                  <p className="text-xs text-muted">
                    {o.orderNumber} · {thDate(o.createdAt)}
                  </p>
                  <p className="mt-1.5 text-sm">{o.items.map((i) => `${i.product.name} ${i.quantity}`).join(" · ")}</p>
                  <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-xs">
                    <span className="text-muted">{editable ? `ปิดรอบ ${thDate(view!.closeAt)}` : `อัปเดต ${thDate(o.updatedAt)}`}</span>
                    <Link href={`/orders/${o.id}`} className="font-semibold text-navy">
                      {editable ? "แก้ไข / ดูรายละเอียด" : "ดูรายละเอียด"}
                    </Link>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted">ปิดรับ {thDate(r.closesAt)} · ไม่มีคำสั่งซื้อในรอบนี้</p>
              )}
            </Card>
          );
        })}
      </main>
    </>
  );
}
