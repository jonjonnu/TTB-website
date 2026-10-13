import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { baht, thDateTime } from "@/lib/format";
import { EXCHANGE_STATUS_LABEL, PAYMENT_LABEL, PAYMENT_METHOD_LABEL, STATUS_LABEL, orderTitle } from "@/lib/portal-labels";
import { DEFAULT_CARRIER } from "@/lib/providers/tracking";
import { Badge, Card, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { markRefunded, saveTracking, updateOrderStatus } from "../../../actions";

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await db.order.findUnique({
    where: { id },
    include: {
      employee: true,
      round: true,
      items: { include: { product: true } },
      events: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
      exchanges: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!o) notFound();
  const back = o.kind === "PERSONAL" ? "/admin/orders?view=personal" : `/admin/orders?round=${o.roundId}`;

  return (
    <div className="max-w-4xl space-y-4">
      <Link href={back} className="text-sm text-navy">
        ‹ คำสั่งซื้อทั้งหมด
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-mono text-xl font-medium">{o.orderNumber}</h1>
        <Badge>{STATUS_LABEL[o.status]}</Badge>
        <Badge tone="gray">{PAYMENT_LABEL[o.paymentStatus]}</Badge>
        {o.benefitMode && <Badge tone="accent">{o.benefitMode === "CREDIT" ? "เครดิต" : "ตามสิทธิ์"}</Badge>}
        {o.editCount > 0 && <Badge tone="accent">แก้ไข {o.editCount} ครั้ง</Badge>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-1 p-4 text-sm">
          <p className="font-medium">
            {o.employee.firstName} {o.employee.lastName} · {o.employee.employeeCode}
          </p>
          <p className="text-muted">
            {o.employee.department}
            {o.employee.subDepartment ? ` · ${o.employee.subDepartment}` : ""} · {o.employee.position}
          </p>
          <p className="pt-1">{orderTitle(o)}</p>
          <p>
            {o.deliveryMethod === "HOME" ? "ส่งที่บ้าน" : "ส่งที่ทำงาน"}: {o.deliveryAddress ?? o.employee.workLocation ?? "-"}
          </p>
          {o.employee.phone && <p className="text-muted">โทร {o.employee.phone}</p>}
        </Card>
        <Card className="space-y-1 p-4 text-sm">
          <Row label="ราคาสินค้า (นอกสิทธิ์)" value={baht(o.subtotal)} />
          {o.creditUsed > 0 && <Row label="หักเครดิต" value={`−${baht(o.creditUsed)}`} />}
          {o.deliveryFee > 0 && <Row label="ค่าส่ง" value={baht(o.deliveryFee)} />}
          <Row label="พนักงานชำระ" value={baht(o.total)} strong />
          <Row label="ชำระแล้ว" value={baht(o.amountPaid)} />
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
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-cream text-left text-xs text-muted">
            <tr>
              {["สินค้า", "ไซส์", "ความยาว", "จำนวน", "ตามสิทธิ์", "คิดราคา", "หมายเหตุ"].map((h) => (
                <th key={h} className="px-3 py-2 font-normal">
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
                <td className="px-3 py-2">{i.entitledQty || "-"}</td>
                <td className="px-3 py-2">{i.extraQty ? `${i.extraQty} × ${baht(i.unitPrice)}` : "-"}</td>
                <td className="px-3 py-2 text-muted">{i.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-4 p-4 text-sm">
          <div>
            <p className="mb-2 font-medium">เปลี่ยนสถานะ</p>
            <form action={updateOrderStatus} className="flex gap-2">
              <input type="hidden" name="orderId" value={o.id} />
              <Select name="status" defaultValue={o.status}>
                {Object.entries(STATUS_LABEL)
                  .filter(([k]) => o.kind === "WELFARE" || k !== "ROUND_CLOSED")
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
              </Select>
              <SubmitButton>บันทึก</SubmitButton>
            </form>
          </div>
          <div>
            <p className="mb-2 font-medium">เลขพัสดุ</p>
            <form action={saveTracking} className="flex gap-2">
              <input type="hidden" name="id" value={o.id} />
              <Input name="carrier" defaultValue={o.carrier ?? DEFAULT_CARRIER} className="w-24" aria-label="ขนส่ง" />
              <Input name="trackingNumber" defaultValue={o.trackingNumber ?? ""} placeholder="เลขพัสดุ" aria-label="เลขพัสดุ" />
              <SubmitButton variant="secondary">บันทึก</SubmitButton>
            </form>
          </div>
          <p className="text-xs text-muted">พนักงานได้รับแจ้งเตือนเมื่อสถานะเปลี่ยน · ใส่เลขพัสดุแล้วสถานะเป็น &ldquo;อยู่ระหว่างจัดส่ง&rdquo; อัตโนมัติ</p>
        </Card>
        <Card className="p-4 text-sm">
          <p className="mb-2 font-medium">ประวัติ</p>
          <ul className="space-y-1">
            {o.events.map((e) => (
              <li key={e.id}>
                <span className="text-muted">{thDateTime(e.createdAt)}</span> · {e.message}
              </li>
            ))}
            {o.payments.map((p) => (
              <li key={p.id}>
                <span className="text-muted">{thDateTime(p.createdAt)}</span> · ชำระ {baht(p.amount)} ({PAYMENT_METHOD_LABEL[p.method]}) {PAYMENT_LABEL[p.status]}
                {p.providerRef && <span className="text-xs text-muted"> · {p.providerRef}</span>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {o.exchanges.length > 0 && (
        <Card className="p-4 text-sm">
          <p className="mb-2 font-medium">คำขอเปลี่ยนสินค้า</p>
          <ul className="space-y-2">
            {o.exchanges.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{EXCHANGE_STATUS_LABEL[x.status]}</Badge>
                <span>{x.details}</span>
                <Link href="/admin/orders?view=exchanges" className="text-navy">
                  จัดการ ›
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between font-medium" : "flex justify-between"}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
