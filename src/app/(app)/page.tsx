import Link from "next/link";
import { requireEmployee } from "@/lib/session";
import { catalogFor, currentRound, pricedCart, computeTotals, canOrder } from "@/lib/portal";
import { baht, thDate, thDateTime, thShortDate } from "@/lib/format";
import { daysLeft, roundLabel } from "@/lib/rounds";
import { Badge, Card, LinkButton, ProductImage, cx } from "@/components/ui";
import { AppHeader } from "./app-header";
import { discardEdit } from "./actions";

export default async function HomePage() {
  const emp = await requireEmployee();
  const view = await currentRound(emp.department);
  const catalog = await catalogFor(emp, view?.round.id ?? null);
  const cart = view ? await pricedCart(emp, view.round.id) : null;
  const totals = cart ? computeTotals(cart.lines, 0) : null;
  const order = catalog.order;
  const editing = !!order && catalog.cartCount > 0;
  const open = canOrder(view, emp, !!order);
  const orderedBy = new Map(order?.items.map((i) => [i.productId, i]) ?? []);
  const chosen = catalog.entitledProducts.filter((p) => p.cart || (!editing && orderedBy.has(p.product.id))).length;
  const showCartBar = open && catalog.cartCount > 0;

  return (
    <>
      <AppHeader emp={emp} />
      <main className={cx("space-y-4 px-4 py-4", showCartBar && "pb-24")}>
        <section>
          <h2 className="text-xl font-bold">สวัสดี คุณ{emp.firstName}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip>รหัส {emp.employeeCode}</Chip>
            <Chip>{[emp.department, emp.subDepartment].filter(Boolean).join(" · ")}</Chip>
            <Chip>{emp.position}</Chip>
          </div>
        </section>

        {view ? (
          <section className="rounded-xl bg-navy p-4 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs opacity-80">รอบสั่งซื้อประจำปี</p>
                <p className="text-lg font-bold">{roundLabel(view.round)}</p>
              </div>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-navy">
                {view.phase === "OPEN" ? (
                  <>
                    <span className="text-ok">●</span> เปิดรับ · เหลือ {daysLeft(view.closeAt)} วัน
                  </>
                ) : view.phase === "UPCOMING" ? (
                  "ยังไม่เปิดรับ"
                ) : (
                  "ปิดรับแล้ว"
                )}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5 text-xs">
              <Phase
                active={view.phase !== "CLOSED"}
                title={`1 · เปิดรับ`}
                value={`${thShortDate(view.round.opensAt)}–${thShortDate(view.closeAt)}`}
              />
              <Phase active={view.phase === "CLOSED"} title="2 · ปิดตรวจสอบ" value={thShortDate(new Date(view.closeAt.getTime() + 60_000))} />
              <Phase active={false} title="3 · ส่งถึงสาขา" value={`ภายใน ${thShortDate(view.deliveryDue)}`} />
            </div>
            {view.extended && (
              <p className="mt-2 rounded-md bg-white/10 px-2 py-1 text-xs">ขยายเวลาปิดรับเป็น {thDateTime(view.closeAt)} น.</p>
            )}
            <div className="mt-3 flex justify-between text-xs opacity-90">
              <span>
                เลือกแล้ว {chosen} จาก {catalog.entitledProducts.length} รายการ
              </span>
              <span>ปิดรับ {thDateTime(view.closeAt)}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/20">
              <div
                className="h-1.5 rounded-full bg-accent"
                style={{ width: `${catalog.entitledProducts.length ? (chosen / catalog.entitledProducts.length) * 100 : 0}%` }}
              />
            </div>
          </section>
        ) : (
          <Card className="p-4 text-sm text-muted">ยังไม่มีรอบสั่งซื้อ ระบบจะแจ้งเตือนเมื่อเปิดรอบใหม่</Card>
        )}

        {order && !editing && (
          <Link href={`/orders/${order.id}`} className="flex items-center justify-between rounded-xl border border-ok/30 bg-ok-50 px-4 py-3">
            <span>
              <span className="block text-sm font-semibold text-ok">สั่งซื้อรอบนี้แล้ว · {order.orderNumber}</span>
              <span className="block text-xs text-muted">
                {open && view ? `แก้ไขได้ถึง ${thDateTime(view.closeAt)} น.` : "ดูสถานะคำสั่งซื้อ"}
              </span>
            </span>
            <span className="text-ok">›</span>
          </Link>
        )}
        {editing && (
          <div className="flex items-center justify-between rounded-xl border border-accent/30 bg-accent-50 px-4 py-3 text-sm">
            <span className="text-[#8a4b0f]">กำลังแก้ไขคำสั่งซื้อ {order!.orderNumber}</span>
            <form action={discardEdit}>
              <button className="text-xs font-semibold text-navy">ยกเลิกการแก้ไข</button>
            </form>
          </div>
        )}
        {view?.phase === "UPCOMING" && (
          <Card className="p-3 text-sm text-muted">เปิดให้เลือกไซส์ได้ตั้งแต่ {thDateTime(view.round.opensAt)} น.</Card>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold">เครื่องแบบตามสิทธิ์ของคุณ</h3>
            <Link href="/account" className="text-xs font-semibold text-navy">
              ดูสิทธิ์ทั้งหมด
            </Link>
          </div>
          {catalog.entitledProducts.length === 0 ? (
            <Card className="p-4 text-sm text-muted">ยังไม่มีรายการตามสิทธิ์ของคุณ กรุณาติดต่อฝ่ายบุคคล</Card>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {catalog.entitledProducts.map(({ product, entitled, cart: c }) => {
                const sel = c ?? (!editing ? orderedBy.get(product.id) : undefined);
                const body = (
                  <>
                    <ProductImage src={product.imageUrl} alt={product.name} className="aspect-[4/3] w-full" />
                    <div className="space-y-1 p-2.5">
                      <p className="line-clamp-2 text-sm font-semibold">{product.name}</p>
                      <p className="text-xs text-muted">สิทธิ์ {entitled} ตัว</p>
                      {sel ? (
                        <Badge tone="ok">
                          ✓ {sel.size}
                          {sel.length ? ` · ${sel.length}` : ""} · {sel.quantity} ตัว
                        </Badge>
                      ) : (
                        <Badge tone="accent">ยังไม่เลือกไซส์</Badge>
                      )}
                    </div>
                  </>
                );
                return open && (editing || !order) ? (
                  <Link key={product.id} href={`/items/${product.id}`} className="overflow-hidden rounded-xl border border-line bg-white">
                    {body}
                  </Link>
                ) : (
                  <div key={product.id} className="overflow-hidden rounded-xl border border-line bg-white">
                    {body}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {open && (editing || !order) && (
          <Link href="/shop" className="flex items-center gap-3 rounded-xl border border-dashed border-accent/50 bg-white p-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-50 text-lg text-accent">+</span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">ต้องการเพิ่มนอกเหนือสิทธิ์?</span>
              <span className="block text-xs text-muted">ซื้อเพิ่มด้วยตัวเอง ชำระเงินออนไลน์ และเลือกส่งที่บ้านได้</span>
            </span>
            <span className="text-muted">›</span>
          </Link>
        )}
        {view && view.phase === "CLOSED" && !order && (
          <Card className="p-3 text-sm text-muted">รอบนี้ปิดรับเมื่อ {thDate(view.closeAt)} แล้ว ระบบจะแจ้งเตือนเมื่อเปิดรอบถัดไป</Card>
        )}
      </main>

      {showCartBar && totals && (
        <div className="fixed inset-x-0 bottom-16 z-10 mx-auto flex max-w-md items-center justify-between border-t border-line bg-white px-4 py-2.5">
          <div className="text-xs">
            <p className="text-muted">เลือกแล้ว {catalog.cartCount} รายการ</p>
            <p className="font-semibold">
              {totals.extrasTotal > 0 ? `ซื้อเพิ่ม ${baht(totals.extrasTotal)}` : `ตามสิทธิ์ ${baht(0)}`}
            </p>
          </div>
          <LinkButton href="/checkout">ตรวจสอบคำสั่งซื้อ</LinkButton>
        </div>
      )}
    </>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-line bg-white px-2.5 py-0.5 text-xs text-muted">{children}</span>;
}

function Phase({ title, value, active }: { title: string; value: string; active: boolean }) {
  return (
    <div className={cx("rounded-lg px-2 py-1.5", active ? "bg-white text-navy" : "bg-white/10")}>
      <p className={cx("text-[10px]", active ? "text-navy/70" : "opacity-70")}>{title}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
