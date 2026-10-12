import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { baht, thDateTime } from "@/lib/format";
import { PAYMENT_LABEL, STATUS_LABEL } from "@/lib/portal";
import { roundLabel } from "@/lib/rounds";
import { Badge, Card, Select } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { markRefunded, updateOrderStatus } from "../../../actions";

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await db.order.findUnique({
    where: { id },
    include: {
      employee: true,
      branch: true,
      round: true,
      items: { include: { product: true } },
      events: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!o) notFound();

  return (
    <div className="max-w-4xl space-y-4">
      <Link href={`/admin/orders?round=${o.roundId}`} className="text-sm text-navy">
        ‹ คำสั่งซื้อทั้งหมด
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-mono text-xl font-bold">{o.orderNumber}</h1>
        <Badge>{STATUS_LABEL[o.status]}</Badge>
        <Badge tone="gray">{PAYMENT_LABEL[o.paymentStatus]}</Badge>
        {o.editCount > 0 && <Badge tone="accent">แก้ไข {o.editCount} ครั้ง</Badge>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4 text-sm">
          <p className="font-semibold">
            {o.employee.firstName} {o.employee.lastName} · {o.employee.employeeCode}
          </p>
          <p className="text-muted">
            {o.employee.department} · {o.employee.position}
          </p>
          <p className="mt-2">{roundLabel(o.round)}</p>
          <p className="mt-2">
            {o.deliveryMethod === "HOME" ? `ส่งที่บ้าน: ${o.homeAddress}` : `รับที่สาขา: ${o.branch?.name ?? "-"}`}
          </p>
        </Card>
        <Card className="space-y-1 p-4 text-sm">
          <div className="flex justify-between">
            <span>ซื้อเพิ่ม</span>
            <span>{baht(o.extrasTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>ค่าส่ง</span>
            <span>{baht(o.deliveryFee)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>รวม</span>
            <span>{baht(o.total)}</span>
          </div>
          <div className="flex justify-between">
            <span>ชำระแล้ว</span>
            <span>{baht(o.amountPaid)}</span>
          </div>
          {o.paymentStatus === "REFUND_DUE" && (
            <form action={markRefunded} className="pt-2">
              <input type="hidden" name="id" value={o.id} />
              <SubmitButton variant="secondary" className="h-9">
                บันทึกว่าคืนเงิน {baht(o.amountPaid - o.total)} แล้ว
              </SubmitButton>
            </form>
          )}
        </Card>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-muted">
            <tr>
              {["สินค้า", "ไซส์", "ความยาว", "จำนวน", "ตามสิทธิ์", "ซื้อเพิ่ม", "หมายเหตุ"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {o.items.map((i) => (
              <tr key={i.id} className="border-t border-line">
                <td className="px-3 py-2">{i.product.name}</td>
                <td className="px-3 py-2">{i.size}</td>
                <td className="px-3 py-2">{i.length ?? "-"}</td>
                <td className="px-3 py-2">{i.quantity}</td>
                <td className="px-3 py-2">{i.entitledQty}</td>
                <td className="px-3 py-2">{i.extraQty ? `${i.extraQty} × ${baht(i.unitPrice)}` : "-"}</td>
                <td className="px-3 py-2 text-muted">{i.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4 text-sm">
          <p className="mb-2 font-semibold">ประวัติ</p>
          <ul className="space-y-1">
            {o.events.map((e) => (
              <li key={e.id}>
                <span className="text-muted">{thDateTime(e.createdAt)}</span> · {e.message}
              </li>
            ))}
            {o.payments.map((p) => (
              <li key={p.id}>
                <span className="text-muted">{thDateTime(p.createdAt)}</span> · การชำระ {baht(p.amount)} ({p.method}) {PAYMENT_LABEL[p.status]}{" "}
                {p.providerRef && <span className="text-xs text-muted">· {p.providerRef}</span>}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4 text-sm">
          <p className="mb-2 font-semibold">เปลี่ยนสถานะ</p>
          <form action={updateOrderStatus} className="flex gap-2">
            <input type="hidden" name="orderId" value={o.id} />
            <Select name="status" defaultValue={o.status}>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <SubmitButton>บันทึก</SubmitButton>
          </form>
          <p className="mt-2 text-xs text-muted">พนักงานจะได้รับการแจ้งเตือนเมื่อสถานะเปลี่ยน</p>
        </Card>
      </div>
    </div>
  );
}
