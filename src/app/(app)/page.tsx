import Link from "next/link";
import { requireEmployee } from "@/lib/session";
import { canOrderWelfare, pricedWelfareCart, welfareCatalog, welfareRoundFor } from "@/lib/portal";
import { serviceLabel } from "@/lib/entitlements";
import { baht, thDate, thDateTime, thShortDate } from "@/lib/format";
import { daysLeft } from "@/lib/rounds";
import { Badge, Card, LinkButton, ProductImage, cx } from "@/components/ui";
import { AppHeader } from "./app-header";
import { discardEdit } from "./actions";

export default async function HomePage() {
  const emp = await requireEmployee();
  const view = await welfareRoundFor(emp);
  const catalog = await welfareCatalog(emp, view);
  const cart = view && catalog.cartCount > 0 ? await pricedWelfareCart(emp, view) : null;
  const order = catalog.order;
  const editing = !!order && catalog.cartCount > 0;
  const open = canOrderWelfare(view, !!order);
  const orderedBy = new Map(order?.items.map((i) => [i.productId, i]) ?? []);
  const selectionOf = (productId: string, c: (typeof catalog.items)[number]["cart"]) =>
    c ?? (!editing ? orderedBy.get(productId) : undefined);
  const setItems = catalog.items.filter((p) => p.entitled > 0);
  const chosen = setItems.filter((p) => selectionOf(p.product.id, p.cart)).length;
  const showCartBar = open && catalog.cartCount > 0 && cart;
  const credit = catalog.benefit.mode === "CREDIT";

  // Credit already committed: the live cart, else the confirmed order.
  const creditUsed = cart ? cart.totals.creditUsed : (order?.creditUsed ?? 0);
  const creditLeft = catalog.benefit.credit - creditUsed;

  return (
    <>
      <AppHeader emp={emp} />
      <main className={cx("space-y-4 px-4 py-4", showCartBar && "pb-24")}>
        <section>
          <h2 className="text-xl font-medium">สวัสดี คุณ{emp.firstName}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip>รหัส {emp.employeeCode}</Chip>
            <Chip>{[emp.department, emp.subDepartment].filter(Boolean).join(" · ")}</Chip>
            <Chip>{emp.position}</Chip>
            <Chip>อายุงาน {serviceLabel(emp.startDate)}</Chip>
          </div>
        </section>

        {view ? (
          <section className="rounded-xl bg-navy p-4 text-white">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs opacity-75">
                  {credit ? `เครดิตเครื่องแบบ · ${view.round.name}` : "สวัสดิการเครื่องแบบประจำปี"}
                </p>
                {credit ? (
                  <>
                    <p className="text-2xl font-medium">เหลือ {baht(Math.max(0, creditLeft))}</p>
                    <p className="text-xs opacity-80">
                      ใช้ไป {baht(creditUsed)} จากเครดิต {baht(catalog.benefit.credit)} · ไม่สะสมไปรอบหน้า
                    </p>
                  </>
                ) : (
                  <p className="text-lg font-medium">{view.round.name}</p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-navy">
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
            {credit && (
              <>
                <div className="mt-3 h-1.5 rounded-full bg-white/20">
                  <div
                    className="h-1.5 rounded-full bg-sand"
                    style={{ width: `${catalog.benefit.credit ? Math.min(100, (creditUsed / catalog.benefit.credit) * 100) : 0}%` }}
                  />
                </div>
                <p className="mt-2 text-xs opacity-85">
                  ใช้เครดิตซื้อสินค้าที่มีป้าย &ldquo;ใช้เครดิตได้&rdquo; ถ้าเกินเครดิต ชำระส่วนต่างด้วย QR, โมบายแบงก์กิ้ง หรือบัตร
                </p>
              </>
            )}
            <div className="mt-3 grid grid-cols-3 gap-1.5 text-xs">
              <Phase active={view.phase !== "CLOSED"} title="1 · เปิดรับ" value={`${thShortDate(view.round.opensAt)}–${thShortDate(view.closeAt)}`} />
              <Phase active={view.phase === "CLOSED"} title="2 · ผลิต" value={`${thShortDate(new Date(view.closeAt.getTime() + 60_000))} →`} />
              <Phase active={false} title="3 · ส่งถึงที่ทำงาน" value={`ภายใน ${thShortDate(view.deliveryDue)}`} />
            </div>
            {view.extended && <p className="mt-2 rounded-md bg-white/10 px-2 py-1 text-xs">ขยายเวลาปิดรับเป็น {thDateTime(view.closeAt)} น.</p>}
            {!credit && (
              <>
                <div className="mt-3 flex justify-between text-xs opacity-90">
                  <span>
                    เลือกแล้ว {chosen} จาก {setItems.length} รายการในชุดสิทธิ์
                  </span>
                  <span>ปิดรับ {thDateTime(view.closeAt)}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-white/20">
                  <div className="h-1.5 rounded-full bg-sand" style={{ width: `${setItems.length ? (chosen / setItems.length) * 100 : 0}%` }} />
                </div>
              </>
            )}
          </section>
        ) : (
          <Card className="p-4 text-sm text-muted">ยังไม่มีรอบสั่งซื้อสวัสดิการ ระบบจะแจ้งเตือนเมื่อเปิดรอบใหม่ ระหว่างนี้สั่งซื้อส่วนตัวได้ที่ร้านค้า</Card>
        )}

        {order && !editing && (
          <Link href={`/orders/${order.id}`} className="flex items-center justify-between rounded-xl border border-ok/30 bg-ok-50 px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-ok">สั่งซื้อรอบนี้แล้ว · {order.orderNumber}</span>
              <span className="block text-xs text-muted">{open && view ? `แก้ไขได้ถึง ${thDateTime(view.closeAt)} น.` : "ดูสถานะคำสั่งซื้อ"}</span>
            </span>
            <span className="text-ok">›</span>
          </Link>
        )}
        {editing && (
          <div className="flex items-center justify-between rounded-xl border border-accent/30 bg-accent-50 px-4 py-3 text-sm">
            <span className="text-accent">กำลังแก้ไขคำสั่งซื้อ {order!.orderNumber}</span>
            <form action={discardEdit}>
              <button className="text-xs font-medium text-navy">ยกเลิกการแก้ไข</button>
            </form>
          </div>
        )}
        {view?.phase === "UPCOMING" && <Card className="p-3 text-sm text-muted">เปิดให้สั่งจองตั้งแต่ {thDateTime(view.round.opensAt)} น.</Card>}

        {view && (
          <section>
            <div className="mb-2 flex items-end justify-between">
              <div>
                <h3 className="font-medium">{credit ? "สินค้าสำหรับแผนกคุณ" : "เครื่องแบบตามสิทธิ์ของคุณ"}</h3>
                {!credit && <p className="text-xs text-muted">ชุดสิทธิ์ตามแผนก ตำแหน่ง และอายุงาน ฟรี · สั่งเกินหรือเพิ่มรายการอื่นได้ ชำระส่วนเกินเอง</p>}
              </div>
              {credit ? (
                <span className="text-xs text-muted">{catalog.items.length} รายการ</span>
              ) : (
                <Link href="/size-guide" className="text-xs font-medium text-navy">
                  คู่มือไซส์
                </Link>
              )}
            </div>
            {catalog.items.length === 0 ? (
              <Card className="p-4 text-sm text-muted">ยังไม่มีรายการสำหรับคุณ กรุณาติดต่อฝ่ายบุคคล</Card>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {catalog.items.map(({ product, entitled, cart: c }) => {
                  const sel = selectionOf(product.id, c);
                  const body = (
                    <>
                      <ProductImage src={product.imageUrl} alt={product.name} className="aspect-[4/3] w-full" />
                      <div className="space-y-1 p-2.5">
                        <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
                        {credit ? (
                          <p className="flex items-center gap-1.5 text-xs">
                            <b>{baht(product.price)}</b> <Badge tone="gray">ใช้เครดิตได้</Badge>
                          </p>
                        ) : (
                          <p className="text-xs text-muted">{entitled > 0 ? `สิทธิ์ ${entitled} ตัว` : `ซื้อเพิ่ม ${baht(product.price)}`}</p>
                        )}
                        {sel ? (
                          <Badge tone="ok">
                            ✓ {sel.size}
                            {sel.length ? ` · ${sel.length}` : ""} × {sel.quantity}
                          </Badge>
                        ) : (
                          <Badge tone={credit || !entitled ? "gray" : "accent"}>{credit || !entitled ? "ยังไม่เลือก" : "ยังไม่เลือกไซส์"}</Badge>
                        )}
                      </div>
                    </>
                  );
                  return open && (editing || !order) ? (
                    <Link key={product.id} href={`/items/${product.id}`} className="overflow-hidden rounded-xl border border-line/70 bg-white">
                      {body}
                    </Link>
                  ) : (
                    <div key={product.id} className="overflow-hidden rounded-xl border border-line/70 bg-white">
                      {body}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <Link href="/store" className="flex items-center gap-3 rounded-xl border border-line/70 bg-white p-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-sand text-lg text-navy">+</span>
          <span className="flex-1">
            <span className="block text-sm font-medium">อยากได้เพิ่ม หรือรายการนอกสิทธิ์?</span>
            <span className="block text-xs text-muted">สั่งซื้อส่วนตัวได้ทุกเมื่อที่ร้านค้า ส่งถึงที่ทำงานฟรี หรือส่งถึงบ้าน</span>
          </span>
          <span className="text-muted">›</span>
        </Link>
        {view && view.phase === "CLOSED" && !order && (
          <Card className="p-3 text-sm text-muted">รอบนี้ปิดรับเมื่อ {thDate(view.closeAt)} แล้ว ระบบจะแจ้งเตือนเมื่อเปิดรอบถัดไป</Card>
        )}
      </main>

      {showCartBar && (
        <div className="fixed inset-x-0 bottom-16 z-10 mx-auto flex max-w-md items-center justify-between border-t border-line bg-white px-4 py-2.5">
          <div className="text-xs">
            <p className="text-muted">
              {credit ? `ในตะกร้า ${cart.lines.reduce((s, l) => s + l.quantity, 0)} ชิ้น · ${baht(cart.totals.subtotal)}` : `เลือกแล้ว ${catalog.cartCount} รายการ`}
            </p>
            <p className={cx("font-medium", cart.totals.total > 0 ? "text-bad" : "text-ok")}>
              {cart.totals.total > 0
                ? `${credit ? "เกินเครดิต" : "ซื้อเพิ่ม"} ${baht(cart.totals.total)}`
                : credit
                  ? "อยู่ในเครดิต ไม่ต้องชำระเพิ่ม"
                  : `ตามสิทธิ์ ${baht(0)}`}
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
      <p className="font-medium">{value}</p>
    </div>
  );
}
