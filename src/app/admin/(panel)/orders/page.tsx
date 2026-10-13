import Link from "next/link";
import { db } from "@/lib/db";
import { baht, thDate } from "@/lib/format";
import { EXCHANGE_REASONS, EXCHANGE_STATUS_LABEL, PAYMENT_LABEL, STATUS_LABEL, STATUS_STEPS } from "@/lib/portal-labels";
import { Badge, Card, Input, Select, cx } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { updateExchange, updateOrderStatus } from "../../actions";
import type { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";

type Search = { view?: string; round?: string; status?: string; payment?: string; location?: string; q?: string };

export default async function OrdersAdminPage({ searchParams }: { searchParams: Promise<Search> }) {
  const f = await searchParams;
  const view = f.view === "personal" || f.view === "exchanges" ? f.view : "welfare";
  const [rounds, locations, exchangeCount] = await Promise.all([
    db.orderRound.findMany({ orderBy: { opensAt: "desc" } }),
    db.employee.findMany({ distinct: ["workLocation"], where: { workLocation: { not: null } }, select: { workLocation: true }, orderBy: { workLocation: "asc" } }),
    db.exchangeRequest.count({ where: { status: { in: ["REQUESTED", "APPROVED"] } } }),
  ]);
  const roundId = f.round ?? rounds.find((r) => r.type === "BIG_LOT")?.id ?? rounds[0]?.id;
  const tab = (v: string, label: string) => {
    const qs = new URLSearchParams({ view: v, ...(v === "welfare" && roundId ? { round: roundId } : {}) });
    return (
      <Link
        key={v}
        href={`/admin/orders?${qs}`}
        className={cx("rounded-lg px-3 py-1.5 text-sm", view === v ? "bg-navy text-white" : "border border-line bg-white text-navy")}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-medium">คำสั่งซื้อ</h1>
        <div className="flex gap-2">
          {tab("welfare", "สวัสดิการ (Big Lot / New Joiners)")}
          {tab("personal", "สั่งซื้อส่วนตัว")}
          {tab("exchanges", `คำขอเปลี่ยนสินค้า${exchangeCount ? ` (${exchangeCount})` : ""}`)}
        </div>
      </div>
      {view === "exchanges" ? (
        <Exchanges />
      ) : (
        <OrderList f={f} kind={view === "personal" ? "PERSONAL" : "WELFARE"} roundId={roundId} rounds={rounds} locations={locations.map((l) => l.workLocation!)} />
      )}
    </div>
  );
}

async function OrderList({
  f,
  kind,
  roundId,
  rounds,
  locations,
}: {
  f: Search;
  kind: "WELFARE" | "PERSONAL";
  roundId?: string;
  rounds: { id: string; name: string }[];
  locations: string[];
}) {
  const scope: Prisma.OrderWhereInput = kind === "WELFARE" ? { kind, roundId } : { kind };
  const where: Prisma.OrderWhereInput = { ...scope };
  if (f.status) where.status = f.status as OrderStatus;
  if (f.payment) where.paymentStatus = f.payment as PaymentStatus;
  if (f.location) where.employee = { workLocation: f.location };
  if (f.q) {
    where.OR = [
      { orderNumber: { contains: f.q, mode: "insensitive" } },
      { trackingNumber: { contains: f.q } },
      { employee: { employeeCode: { contains: f.q } } },
      { employee: { firstName: { contains: f.q, mode: "insensitive" } } },
    ];
  }
  const [orders, counts, money] = await Promise.all([
    db.order.findMany({
      where,
      include: { employee: true, _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    db.order.groupBy({ by: ["status"], where: scope, _count: true }),
    db.order.aggregate({ where: scope, _sum: { amountPaid: true, creditUsed: true } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const steps = kind === "WELFARE" ? STATUS_STEPS : STATUS_STEPS.filter((s) => s.status !== "ROUND_CLOSED");

  return (
    <>
      <Card className="p-3">
        <form className="flex flex-wrap gap-2">
          <input type="hidden" name="view" value={kind === "WELFARE" ? "welfare" : "personal"} />
          {kind === "WELFARE" && (
            <Select name="round" defaultValue={roundId} className="w-auto">
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          )}
          <Input name="q" defaultValue={f.q ?? ""} placeholder="เลขที่ / รหัส / ชื่อ / เลขพัสดุ" className="w-56" />
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
          <Select name="location" defaultValue={f.location ?? ""} className="w-auto">
            <option value="">ทุกสถานที่ทำงาน</option>
            {locations.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>
          <button className="rounded-lg bg-navy px-4 text-sm text-white">กรอง</button>
          {kind === "WELFARE" && roundId && (
            <a href={`/admin/export/orders?round=${roundId}`} className="ml-auto self-center text-sm text-navy">
              ดาวน์โหลด CSV สำหรับผลิต
            </a>
          )}
        </form>
      </Card>

      <div className="flex flex-wrap gap-2 text-xs">
        {steps.map((s) => (
          <Badge key={s.status} tone="gray">
            {s.label}: {count(s.status)}
          </Badge>
        ))}
        <Badge tone="ok">รับชำระแล้ว {baht(money._sum.amountPaid ?? 0)}</Badge>
        {kind === "WELFARE" && <Badge tone="navy">ใช้เครดิต {baht(money._sum.creditUsed ?? 0)}</Badge>}
      </div>

      <form action={updateOrderStatus}>
        {kind === "WELFARE" && <input type="hidden" name="roundId" value={roundId ?? ""} />}
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-cream text-left text-xs text-muted">
              <tr>
                <th className="w-8 px-3 py-2" />
                {["เลขที่", "พนักงาน", "รายการ", "จัดส่ง", "เครดิต", "ชำระ", "การชำระเงิน", "สถานะ", "เลขพัสดุ"].map((h) => (
                  <th key={h} className="px-3 py-2 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-line">
                  <td className="px-3 py-2">
                    <input type="checkbox" name="orderId" value={o.id} className="accent-navy" aria-label={`เลือก ${o.orderNumber}`} />
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs text-navy">
                      {o.orderNumber}
                    </Link>
                    <span className="block text-xs text-muted">{thDate(o.createdAt)}</span>
                  </td>
                  <td className="px-3 py-2">
                    {o.employee.firstName} {o.employee.lastName}
                    <span className="block text-xs text-muted">
                      {o.employee.employeeCode} · {o.employee.department}
                    </span>
                  </td>
                  <td className="px-3 py-2">{o._count.items}</td>
                  <td className="px-3 py-2 text-xs">{o.deliveryMethod === "HOME" ? "ส่งที่บ้าน" : (o.employee.workLocation ?? "ที่ทำงาน")}</td>
                  <td className="px-3 py-2">{o.creditUsed ? baht(o.creditUsed) : "-"}</td>
                  <td className="px-3 py-2">{baht(o.total)}</td>
                  <td className="px-3 py-2">
                    <Badge tone={o.paymentStatus === "PENDING" ? "accent" : o.paymentStatus === "REFUND_DUE" ? "bad" : o.paymentStatus === "PAID" ? "ok" : "gray"}>
                      {PAYMENT_LABEL[o.paymentStatus]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={o.status === "DELIVERED" ? "ok" : o.status === "CANCELLED" ? "gray" : "navy"}>{STATUS_LABEL[o.status]}</Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{o.trackingNumber ?? "-"}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-muted">
                    ไม่มีคำสั่งซื้อ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <Card className="mt-3 flex flex-wrap items-center gap-3 p-3 text-sm">
          <span className="font-medium">อัปเดตสถานะ</span>
          <Select name="status" className="w-auto" defaultValue="PRODUCING">
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          {kind === "WELFARE" && (
            <label className="flex items-center gap-2">
              <input type="checkbox" name="applyAll" className="accent-navy" />
              ใช้กับทุกคำสั่งซื้อในรอบนี้
            </label>
          )}
          <span className="text-xs text-muted">ใส่เลขพัสดุทีละหลายรายการได้จากไฟล์ CSV ที่หน้าพนักงาน</span>
          <SubmitButton className="ml-auto">อัปเดตและแจ้งพนักงาน</SubmitButton>
        </Card>
      </form>
    </>
  );
}

const REASON_LABEL: Record<string, string> = Object.fromEntries(EXCHANGE_REASONS.map((r) => [r.value, r.label]));

async function Exchanges() {
  const list = await db.exchangeRequest.findMany({
    include: { employee: true, order: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  return (
    <div className="space-y-3">
      {list.map((x) => (
        <Card key={x.id} className="p-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium">
                {x.employee.firstName} {x.employee.lastName} · {x.employee.employeeCode}
              </p>
              <p className="text-muted">
                <Link href={`/admin/orders/${x.orderId}`} className="font-mono text-navy">
                  {x.order.orderNumber}
                </Link>{" "}
                · {REASON_LABEL[x.reason]} · {thDate(x.createdAt)}
              </p>
            </div>
            <Badge tone={x.status === "REQUESTED" ? "accent" : x.status === "COMPLETED" ? "ok" : x.status === "REJECTED" ? "gray" : "navy"}>
              {EXCHANGE_STATUS_LABEL[x.status]}
            </Badge>
          </div>
          <p className="mt-2 rounded-lg bg-cream px-3 py-2">{x.details}</p>
          <form action={updateExchange} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={x.id} />
            <Select name="status" defaultValue={x.status} className="w-auto">
              {Object.entries(EXCHANGE_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <Input name="adminNote" defaultValue={x.adminNote ?? ""} placeholder="ข้อความถึงพนักงาน เช่น ส่งไซส์ใหม่ภายใน 7 วัน" className="min-w-64 flex-1" />
            <SubmitButton variant="secondary">บันทึกและแจ้งพนักงาน</SubmitButton>
          </form>
        </Card>
      ))}
      {list.length === 0 && <Card className="p-6 text-center text-sm text-muted">ยังไม่มีคำขอเปลี่ยนสินค้า</Card>}
    </div>
  );
}
