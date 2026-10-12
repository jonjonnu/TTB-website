import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireEmployee } from "@/lib/session";
import { TopBar } from "@/components/ui";
import { ExchangeForm } from "./form";

export default async function ExchangePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const emp = await requireEmployee();
  const order = await db.order.findFirst({ where: { id, employeeId: emp.id }, include: { items: { include: { product: true } } } });
  if (!order) notFound();
  return (
    <>
      <TopBar title="ขอเปลี่ยนสินค้า" back={`/orders/${order.id}`} />
      <main className="space-y-3 px-4 py-4">
        <p className="text-sm text-muted">
          คำสั่งซื้อ {order.orderNumber} · เปลี่ยนได้ฟรีกรณีไซส์ไม่พอดี สินค้าชำรุดจากการผลิต หรือได้รับสินค้าผิดรายการ ทีม Songsmai จะติดต่อกลับภายใน 3 วันทำการ
        </p>
        <ExchangeForm orderId={order.id} items={order.items.map((i) => `${i.product.name} (${i.size}${i.length ? ` · ${i.length}` : ""})`)} />
      </main>
    </>
  );
}
