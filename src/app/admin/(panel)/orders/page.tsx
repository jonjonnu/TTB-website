import Link from "next/link";
import { db } from "@/lib/db";
import { baht, thDate } from "@/lib/format";
import { PAYMENT_LABEL, STATUS_LABEL, STATUS_STEPS } from "@/lib/portal";
import { roundLabel } from "@/lib/rounds";
import { Badge, Card, Select } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { updateOrderStatus } from "../../actions";
import type { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";

export default async function OrdersAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string; status?: string; payment?: string; delivery?: string }>;
}) {
  const f = await searchParams;
  const rounds = await db.orderRound.findMany({ orderBy: { opensAt: "desc" } });
  const roundId = f.round ?? rounds[0]?.id;
  const where: Prisma.OrderWhereInput = { roundId };
  if (f.status) where.status = f.status as OrderStatus;
  if (f.payment) where.paymentStatus = f.payment as PaymentStatus;
  if (f.delivery === "HOME" || f.delivery === "BRANCH") where.deliveryMethod = f.delivery;
  const [orders, counts, money] = await Promise.all([
    db.order.findMany({
      where,
      include: { employee: true, branch: true, _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.order.groupBy({ by: ["status"], where: { roundId }, _count: true }),
    db.order.aggregate({ where: { roundId }, _sum: { amountPaid: true, total: true } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">คำสั่งซื้อ</h1>
      <Card className="p-3">
        <form className="flex flex-wrap gap-2">
          <Select name="round" defaultValue={roundId} className="w-auto">
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {roundLabel(r)}
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={f.status ?? ""} className="w-auto">
            <option value="">ทุกสถานะ</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Select name="payment" defaultValue={f.payment ?? ""} className="w-auto">
            <option value="">การชำระเงินทั้งหมด</option>
            {Object.entries(PAYMENT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Select name="delivery" defaultValue={f.delivery ?? ""} className="w-auto">
            <option value="">ทุกการจัดส่ง</option>
            <option value="BRANCH">รับที่สาขา</option>
            <option value="HOME">ส่งที่บ้าน</option>
          </Select>
          <button className="rounded-lg bg-navy px-4 text-sm font-semibold text-white">กรอง</button>
          {roundId && (
            <a href={`/admin/export/orders?round=${roundId}`} className="ml-auto self-center text-sm font-semibold text-navy">
              ดาวน์โหลด CSV สำหรับผลิต
            </a>
          )}
        </form>
      </Card>

      <div className="flex flex-wrap gap-2 text-xs">
        {STATUS_STEPS.map((s) => (
          <Badge key={s.status} tone="gray">
            {s.label}: {count(s.status)}
          </Badge>
        ))}
        <Badge tone="ok">รับชำระแล้ว {baht(money._sum.amountPaid ?? 0)}</Badge>
      </div>

      <form action={updateOrderStatus}>
        <input type="hidden" name="roundId" value={roundId ?? ""} />
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-gray-50 text-left text-xs text-muted">
              <tr>
                <th className="w-8 px-3 py-2" />
                {["เลขที่", "พนักงาน", "รายการ", "จัดส่ง", "ยอด", "ชำระเงิน", "สถานะ", "วันที่"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-line">
                  <td className="px-3 py-2">
                    <input type="checkbox" name="orderId" value={o.id} className="accent-navy" />
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs font-semibold text-navy">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {o.employee.firstName} {o.employee.lastName}
                    <span className="block text-xs text-muted">
                      {o.employee.employeeCode} · {o.employee.department}
                    </span>
                  </td>
                  <td className="px-3 py-2">{o._count.items}</td>
                  <td className="px-3 py-2">{o.deliveryMethod === "HOME" ? "ส่งที่บ้าน" : (o.branch?.name ?? "-")}</td>
                  <td className="px-3 py-2">{baht(o.total)}</td>
                  <td className="px-3 py-2">
                    <Badge tone={o.paymentStatus === "PENDING" ? "accent" : o.paymentStatus === "REFUND_DUE" ? "bad" : "gray"}>
                      {PAYMENT_LABEL[o.paymentStatus]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={o.status === "DELIVERED" ? "ok" : "navy"}>{STATUS_LABEL[o.status]}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{thDate(o.createdAt)}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-muted">
                    ไม่มีคำสั่งซื้อ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <Card className="mt-3 flex flex-wrap items-center gap-3 p-3 text-sm">
          <span className="font-semibold">อัปเดตสถานะ</span>
          <Select name="status" className="w-auto" defaultValue="REVIEWING">
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="applyAll" className="accent-navy" />
            ใช้กับทุกคำสั่งซื้อในรอบนี้ (ไม่ต้องเลือกทีละรายการ)
          </label>
          <SubmitButton className="ml-auto">อัปเดตและแจ้งพนักงาน</SubmitButton>
        </Card>
      </form>
    </div>
  );
}
