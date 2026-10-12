import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { baht, thDate, thDateTime } from "@/lib/format";
import {
  canOrderWelfare,
  EXCHANGE_REASONS,
  EXCHANGE_STATUS_LABEL,
  orderTitle,
  PAYMENT_LABEL,
  PAYMENT_METHOD_LABEL,
  PERSONAL_STEPS,
  STATUS_STEPS,
  viewOf,
  welfareRoundFor,
} from "@/lib/portal";
import { requireEmployee } from "@/lib/session";
import { Badge, Card, LinkButton, TopBar, cx } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { startEdit } from "../../actions";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const [{ id }, { done }] = await Promise.all([params, searchParams]);
  const emp = await requireEmployee();
  const order = await db.order.findFirst({
    where: { id, employeeId: emp.id },
    include: {
      items: { include: { product: true } },
      events: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      exchanges: { orderBy: { createdAt: "desc" } },
      round: { include: { extensions: true, policies: true } },
    },
  });
  if (!order) notFound();
  const welfare = order.kind === "WELFARE" && order.round;
  const rv = welfare ? viewOf(order.round!, emp) : null;
  const current = welfare ? await welfareRoundFor(emp) : null;
  const editable = !!rv && current?.round.id === order.roundId && canOrderWelfare(current, true) && order.status === "PLACED";
  const steps = welfare ? STATUS_STEPS : PERSONAL_STEPS;
  const stepIndex = steps.findIndex((s) => s.status === order.status);
  const eventAt = (status: string) => order.events.find((e) => e.status === status)?.createdAt;
  const pending = order.payments.find((p) => p.status === "PENDING");
  const lastPaid = order.payments.find((p) => p.status === "PAID");
  const reasonLabel = Object.fromEntries(EXCHANGE_REASONS.map((r) => [r.value, r.label]));
  const where = order.deliveryMethod === "HOME" ? "บ้าน" : "ที่ทำงาน";

  return (
    <>
      <TopBar title={orderTitle(order)} back="/orders" />
      <main className="space-y-3 px-4 py-4">
        <div className="py-2 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-ok-50 text-xl text-ok">✓</div>
          <h2 className="mt-2 text-lg font-medium">
            {order.paymentStatus === "PENDING" ? "รอชำระเงิน" : done ? "ส่งคำสั่งซื้อเรียบร้อย" : "คำสั่งซื้อของคุณ"}
          </h2>
          <p className="text-sm text-muted">
            เลขที่ <b className="text-ink">{order.orderNumber}</b>
            {order.total > 0 && lastPaid && ` · ชำระ${welfare ? "ส่วนเกิน" : ""} ${baht(order.amountPaid)} ด้วย ${PAYMENT_METHOD_LABEL[lastPaid.method]}`}
            {order.total === 0 && (order.creditUsed > 0 ? ` · ใช้เครดิต ${baht(order.creditUsed)}` : " · ตามสิทธิ์ ไม่มีค่าใช้จ่าย")}
          </p>
          {done && order.paymentStatus !== "PENDING" && (
            <p className="mt-1 text-xs text-muted">
              ส่งยืนยันไปทาง{[emp.notifyEmail && "อีเมล", emp.notifySms && "SMS"].filter(Boolean).join("และ") || "แอป"}แล้ว
            </p>
          )}
        </div>

        {pending && (
          <Card className="flex items-center justify-between border-accent/40 p-3">
            <span className="text-sm">
              ยังไม่ได้ชำระ <b>{baht(pending.amount)}</b>
            </span>
            <LinkButton href={`/pay/${pending.id}`} className="h-9">
              ชำระเงิน
            </LinkButton>
          </Card>
        )}
        {order.paymentStatus === "REFUND_DUE" && (
          <Card className="p-3 text-sm text-warn">ยอดลดลงหลังแก้ไข ส่วนต่าง {baht(order.amountPaid - order.total)} จะคืนให้โดยทีม Songsmai</Card>
        )}

        {editable && rv && (
          <Card className="space-y-2 p-3">
            <p className="text-sm">
              ✎ แก้ไขได้ถึง <b>{thDateTime(current!.closeAt)} น.</b> ทุกครั้งที่แก้ไข ระบบจะส่งการแจ้งเตือนยืนยันให้คุณ
            </p>
            <form action={startEdit}>
              <input type="hidden" name="orderId" value={order.id} />
              <SubmitButton variant="secondary" className="w-full">
                แก้ไขคำสั่งซื้อ
              </SubmitButton>
            </form>
          </Card>
        )}

        <Card className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium">สถานะสินค้า</p>
            <span className="max-w-[60%] truncate text-xs text-muted">
              ส่งถึง{where}
              {order.deliveryAddress ? ` · ${order.deliveryAddress}` : ""}
            </span>
          </div>
          {order.status === "CANCELLED" ? (
            <Badge tone="bad">ยกเลิก</Badge>
          ) : (
            <ol className="relative ml-1.5 border-l border-line">
              {steps.map((s, i) => {
                const at = eventAt(s.status);
                const hint =
                  s.status === "ROUND_CLOSED" && rv
                    ? `${thDate(rv.closeAt)} · หลังจากนี้แก้ไขไม่ได้`
                    : s.status === "SHIPPING"
                      ? order.trackingNumber
                        ? `${order.carrier ?? "J&T"} ${order.trackingNumber}`
                        : `แจ้งเลขพัสดุ${order.carrier ?? " J&T"} เมื่อส่งออก`
                      : s.status === "DELIVERED" && rv
                        ? `ภายใน ${thDate(rv.deliveryDue)} (${order.round!.deliveryDays} วันหลังปิดรอบ)`
                        : "";
                return (
                  <li key={s.status} className="mb-3 ml-4 last:mb-0">
                    <span
                      className={cx(
                        "absolute -left-[6px] mt-1 h-3 w-3 rounded-full border-2",
                        i < stepIndex ? "border-ok bg-ok" : i === stepIndex ? "border-navy bg-white" : "border-gray-300 bg-white",
                      )}
                    />
                    <p className={cx("text-sm", i <= stepIndex ? "font-medium" : "text-muted")}>
                      {s.status === "PLACED" && order.total > 0 ? `${s.label}และชำระ${welfare ? "ส่วนเกิน" : "เงิน"}แล้ว` : s.label}
                    </p>
                    <p className="text-xs text-muted">{at ? thDateTime(at) : hint}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <Card>
          <p className="border-b border-line px-3 py-2.5 font-medium">รายการ</p>
          {order.items.map((i) => (
            <div key={i.id} className="flex justify-between gap-2 border-b border-line px-3 py-2 text-sm last:border-0">
              <div>
                <p>{i.product.name}</p>
                <p className="text-xs text-muted">
                  {i.size}
                  {i.length ? ` · ${i.length}` : ""} · {i.quantity} ตัว
                  {i.note ? ` · หมายเหตุ: ${i.note}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-xs">
                {order.benefitMode === "FIXED" ? (
                  i.extraQty > 0 ? (
                    <Badge tone="accent">ซื้อเพิ่ม {baht(i.extraQty * i.unitPrice)}</Badge>
                  ) : (
                    <Badge tone="ok">ตามสิทธิ์</Badge>
                  )
                ) : (
                  baht(i.quantity * i.unitPrice)
                )}
              </span>
            </div>
          ))}
          {(order.creditUsed > 0 || order.deliveryFee > 0 || order.total > 0) && (
            <div className="space-y-0.5 px-3 py-2 text-xs text-muted">
              {order.creditUsed > 0 && <p>หักเครดิต −{baht(order.creditUsed)}</p>}
              {order.deliveryFee > 0 && <p>ค่าส่งถึงบ้าน {baht(order.deliveryFee)}</p>}
              <p className="text-ink">
                ยอดชำระ {baht(order.total)} · {PAYMENT_LABEL[order.paymentStatus]}
              </p>
            </div>
          )}
        </Card>

        {order.exchanges.length > 0 && (
          <Card className="p-3 text-sm">
            <p className="mb-1 font-medium">คำขอเปลี่ยนสินค้า</p>
            {order.exchanges.map((x) => (
              <p key={x.id} className="text-xs">
                {thDate(x.createdAt)} · {reasonLabel[x.reason]} · <b>{EXCHANGE_STATUS_LABEL[x.status]}</b>
                {x.adminNote ? ` · ${x.adminNote}` : ""}
              </p>
            ))}
          </Card>
        )}
        {(order.status === "SHIPPING" || order.status === "DELIVERED") && (
          <Card className="flex items-center justify-between p-3 text-sm">
            <span className="text-muted">ไซส์ไม่พอดี ชำรุด หรือส่งผิดรายการ? เปลี่ยนได้ฟรี</span>
            <Link href={`/orders/${order.id}/exchange`} className="shrink-0 font-medium text-navy">
              ขอเปลี่ยนสินค้า
            </Link>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <LinkButton href="/notifications" variant="secondary">
            การแจ้งเตือน
          </LinkButton>
          <LinkButton href="/orders">ประวัติคำสั่งซื้อ</LinkButton>
        </div>
      </main>
    </>
  );
}
