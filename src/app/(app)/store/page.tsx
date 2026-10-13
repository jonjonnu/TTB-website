import Link from "next/link";
import { db } from "@/lib/db";
import { requireEmployee } from "@/lib/session";
import { baht } from "@/lib/format";
import { Badge, ProductImage, cx } from "@/components/ui";
import { AppHeader } from "../app-header";
import type { Prisma } from "@prisma/client";

export default async function StorePage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; added?: string }> }) {
  const { q, cat, added } = await searchParams;
  const emp = await requireEmployee();
  const where: Prisma.ProductWhereInput = { active: true, personalSale: true };
  if (q) where.name = { contains: q, mode: "insensitive" };
  if (cat) where.category = cat;
  const [products, categories, cartCount] = await Promise.all([
    db.product.findMany({ where, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.product.findMany({ where: { active: true, personalSale: true, category: { not: null } }, distinct: ["category"], select: { category: true } }),
    db.cartItem.count({ where: { employeeId: emp.id, kind: "PERSONAL" } }),
  ]);
  // Items nobody gets through welfare (e.g. the Branch dress) are flagged as personal-only.
  const ruled = new Set((await db.entitlementRule.findMany({ select: { productId: true } })).map((r) => r.productId));

  return (
    <>
      <AppHeader emp={emp} title="ร้านค้า" cartCount={cartCount} />
      <main className="space-y-3 px-4 py-4">
        <form>
          <input
            name="q"
            defaultValue={q}
            placeholder="ค้นหาเสื้อ กางเกง ชุดเดรส…"
            className="h-11 w-full rounded-lg border border-line bg-cream px-3 text-sm outline-none focus:border-navy"
          />
          {cat && <input type="hidden" name="cat" value={cat} />}
        </form>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          <Chip href="/store" active={!cat}>
            ทั้งหมด
          </Chip>
          {categories.map((c) => (
            <Chip key={c.category} href={`/store?cat=${encodeURIComponent(c.category!)}`} active={cat === c.category}>
              {c.category}
            </Chip>
          ))}
        </div>
        {added && (
          <div className="flex items-center justify-between rounded-lg bg-ok-50 px-3 py-2 text-sm text-ok">
            เพิ่มลงตะกร้าแล้ว
            <Link href="/store/cart" className="font-medium underline">
              ไปที่ตะกร้า ({cartCount})
            </Link>
          </div>
        )}
        <div className="rounded-xl bg-navy p-4 text-white">
          <p className="text-[10px] tracking-widest opacity-70">PERSONAL ORDER</p>
          <p className="text-lg font-medium">ซื้อเพิ่มได้ทุกเมื่อ ไม่ต้องรอรอบสวัสดิการ</p>
          <p className="text-xs opacity-80">ชำระเต็มจำนวน · ส่งถึงที่ทำงานฟรี หรือส่งถึงบ้าน (มีค่าส่ง)</p>
        </div>
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{cat ?? "สินค้าทั้งหมด"}</h3>
          <span className="text-xs text-muted">{products.length} รายการ</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => (
            <Link key={p.id} href={`/store/${p.id}`} className="relative overflow-hidden rounded-xl border border-line/70 bg-white">
              {!ruled.has(p.id) && (
                <span className="absolute left-2 top-2 z-[1]">
                  <Badge tone="ok">ซื้อได้เฉพาะส่วนตัว</Badge>
                </span>
              )}
              <ProductImage src={p.imageUrl} alt={p.name} className="aspect-square w-full" />
              <div className="space-y-0.5 p-2.5">
                <p className="line-clamp-2 text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted">
                  {p.sizes.length > 1 ? `${p.sizes[0]}–${p.sizes[p.sizes.length - 1]}` : p.sizes[0]}
                  {p.lengths.length ? ` · ${p.lengths.length} ความยาว` : ""}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-medium">{baht(p.price)}</span>
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-navy text-white">+</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
        {products.length === 0 && <p className="py-6 text-center text-sm text-muted">ไม่พบสินค้า</p>}
      </main>
    </>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cx("shrink-0 rounded-full border px-3 py-1 text-sm", active ? "border-navy bg-navy text-white" : "border-line bg-white")}
    >
      {children}
    </Link>
  );
}
