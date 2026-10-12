import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { baht, thDate, thDateTime } from "@/lib/format";
import { canOrder, currentRound, PAYMENT_LABEL, STATUS_STEPS } from "@/lib/portal";
import { deliveryDueAt, effectiveCloseAt, roundLabel } from "@/lib/rounds";
import { requireEmployee } from "@/lib/session";
import { Badge, Card, LinkButton, Logo, cx } from "@/components/ui";
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
      branch: true,
      round: { include: { extensions: true } },
    },
  });
  if (!order) notFound();
  const view = await currentRound(emp.department);
  const editable = view?.round.id === order.roundId && canOrder(view, emp, true) && order.status === "PLACED";
  const closeAt = effectiveCloseAt(order.round, order.round.extensions, emp.department);
  const due = deliveryDueAt(closeAt, order.round.deliveryDays);
  const pending = order.payments.find((p) => p.status === "PENDING");
  const stepIndex = STATUS_STEPS.findIndex((s) => s.status === order.status);
  const eventAt = (status: string) => order.events.find((e) => e.status === status)?.createdAt;
  const lastPaid = order.payments.find((p) => p.status === "PAID");

  return (
    <>
      <header className="flex h-14 items-center border-b border-line bg-white px-4">
        <Logo />
      </header>
      <main className="space-y-3 px-4 py-4">
        <div className="py-2 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-ok-50 text-xl text-ok">✓</div>
          <h2 className="mt-2 text-lg font-bold">
            {order.paymentStatus === "PENDING" ? "รอชำระเงิน" : done ? "สั่งซื้อเรียบร้อยแล้ว" : "คำสั่งซื้อของคุณ"}
          </h2>
          <p className="text-sm text-muted">
            เลขที่ <b className="text-ink">{order.orderNumber}</b> · {roundLabel(order.round)}
          </p>
          <p className="text-sm text-muted">
            {order.total > 0
              ? `ยอด ${baht(order.total)} · ${PAYMENT_LABEL[order.paymentStatus]}${lastPaid ? ` ด้วย ${lastPaid.method === "PROMPTPAY" ? "PromptPay" : "บัตร"}` : ""}`
              : "ตามสิทธิ์ ไม่มีค่าใช้จ่าย"}
          </p>
          {done && order.paymentStatus !== "PENDING" && (
            <p className="mt-1 text-xs text-muted">ส่งยืนยันไปทาง{[emp.notifyEmail && "อีเมล", emp.notifySms && "SMS"].filter(Boolean).join("และ") || "แอป"}แล้ว</p>
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

        {editable && (
          <Card className="space-y-2 p-3">
            <p className="text-sm">
              ✎ แก้ไขได้ถึง <b>{thDateTime(closeAt)} น.</b> หลังจากนั้นระบบจะปิดรอบเพื่อตรวจสอบและแจ้งเตือนเมื่อสินค้าจัดส่ง
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
            <p className="font-semibold">สถานะสินค้า</p>
            <span className="text-xs text-muted">
              ส่งถึง{order.deliveryMethod === "HOME" ? "บ้าน" : "สาขา"}ภายใน {thDate(due)}
            </span>
          </div>
          {order.status === "CANCELLED" ? (
            <Badge tone="bad">ยกเลิก</Badge>
          ) : (
            <ol className="relative ml-1.5 border-l border-line">
              {STATUS_STEPS.map((s, i) => {
                const reached = i <= stepIndex;
                const at = eventAt(s.status);
                return (
                  <li key={s.status} className="mb-3 ml-4 last:mb-0">
                    <span
                      className={cx(
                        "absolute -left-[6px] mt-1 h-3 w-3 rounded-full border-2",
                        i < stepIndex ? "border-ok bg-ok" : i === stepIndex ? "border-navy bg-white" : "border-gray-300 bg-white",
                      )}
                    />
                    <p className={cx("text-sm", reached ? "font-semibold" : "text-muted")}>
                      {s.status === "SHIPPED" && order.deliveryMethod === "BRANCH" ? "จัดส่งถึงสาขา" : s.status === "SHIPPED" ? "จัดส่งถึงบ้าน" : s.label}
                    </p>
                    <p className="text-xs text-muted">
                      {at
                        ? thDateTime(at)
                        : s.status === "ROUND_CLOSED"
                          ? `${thDateTime(closeAt)} · หลังจากนี้แก้ไขไม่ได้`
                          : s.status === "SHIPPED"
                            ? `ภายใน ${thDate(due)} (${order.round.deliveryDays} วันหลังปิดรอบ)`
                            : ""}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <Card>
          <p className="border-b border-line px-3 py-2.5 font-semibold">รายการ</p>
          {order.items.map((i) => (
            <div key={i.id} className="flex justify-between gap-2 border-b border-line px-3 py-2 text-sm last:border-0">
              <div>
                <p className="font-medium">{i.product.name}</p>
                <p className="text-xs text-muted">
                  {i.size}
                  {i.length ? ` · ${i.length}` : ""} · {i.quantity} ตัว
                  {i.note ? ` · หมายเหตุ: ${i.note}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-xs">
                {i.extraQty > 0 ? <Badge tone="accent">ซื้อเพิ่ม {baht(i.extraQty * i.unitPrice)}</Badge> : <Badge tone="ok">ตามสิทธิ์</Badge>}
              </span>
            </div>
          ))}
          <div className="px-3 py-2 text-xs text-muted">
            {order.deliveryMethod === "HOME"
              ? `ส่งที่บ้าน (${baht(order.deliveryFee)}): ${order.homeAddress}`
              : `รับที่สาขา: ${order.branch?.name ?? "-"}`}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <LinkButton href="/notifications" variant="secondary">
            การแจ้งเตือน
          </LinkButton>
          <LinkButton href="/orders">ประวัติคำสั่งซื้อ</LinkButton>
        </div>
        <p className="text-center text-xs">
          <Link href="/" className="text-navy">
            กลับหน้าแรก
          </Link>
        </p>
      </main>
    </>
  );
}
