import Link from "next/link";
import { redirect } from "next/navigation";
import { requireEmployee } from "@/lib/session";
import { canOrder, catalogFor, currentRound } from "@/lib/portal";
import { baht } from "@/lib/format";
import { Badge, ProductImage, TopBar } from "@/components/ui";

export default async function ShopPage() {
  const emp = await requireEmployee();
  const view = await currentRound(emp.department);
  const catalog = await catalogFor(emp, view?.round.id ?? null);
  if (!canOrder(view, emp, !!catalog.order)) redirect("/");
  const all = [...catalog.entitledProducts, ...catalog.extraProducts];

  return (
    <>
      <TopBar title="ซื้อเพิ่มนอกเหนือสิทธิ์" back="/" />
      <main className="space-y-3 px-4 py-4">
        <p className="text-sm text-muted">
          เลือกจำนวนเกินสิทธิ์ หรือสั่งรายการอื่นเพิ่มได้ ระบบคิดเงินเฉพาะส่วนที่เกินสิทธิ์ และเลือกส่งที่บ้านได้ (มีค่าส่ง)
        </p>
        <div className="grid grid-cols-2 gap-3">
          {all.map(({ product, entitled, cart }) => (
            <Link key={product.id} href={`/items/${product.id}`} className="overflow-hidden rounded-xl border border-line bg-white">
              <ProductImage src={product.imageUrl} alt={product.name} className="aspect-[4/3] w-full" />
              <div className="space-y-1 p-2.5">
                <p className="line-clamp-2 text-sm font-semibold">{product.name}</p>
                <p className="text-xs text-muted">{baht(product.price)} / ตัว</p>
                {cart ? (
                  <Badge tone="ok">✓ ในรายการ {cart.quantity} ตัว</Badge>
                ) : entitled > 0 ? (
                  <Badge>มีสิทธิ์ {entitled} ตัว</Badge>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
