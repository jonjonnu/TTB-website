import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireEmployee } from "@/lib/session";
import { canOrderWelfare, pricedWelfareCart, welfareCatalog, welfareRoundFor } from "@/lib/portal";
import { baht } from "@/lib/format";
import { TopBar } from "@/components/ui";
import { ItemForm } from "./item-form";

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ id }, { next }] = await Promise.all([params, searchParams]);
  const emp = await requireEmployee();
  const view = await welfareRoundFor(emp);
  const catalog = await welfareCatalog(emp, view);
  if (!view || !canOrderWelfare(view, !!catalog.order)) redirect("/");
  const entry = catalog.items.find((i) => i.product.id === id);
  if (!entry) {
    const exists = await db.product.findUnique({ where: { id } });
    if (!exists) notFound();
    redirect(`/store/${id}`); // not part of this employee's welfare: buy it personally
  }
  const { product, entitled, cart } = entry;
  const credit = catalog.benefit.mode === "CREDIT";
  let creditLeft = 0;
  if (credit) {
    const priced = await pricedWelfareCart(emp, view);
    const others = priced.lines.filter((l) => l.productId !== id).reduce((s, l) => s + l.lineTotal, 0);
    creditLeft = Math.max(0, catalog.benefit.credit - others);
  }

  return (
    <>
      <TopBar
        title="รายละเอียดเครื่องแบบ"
        back={next === "checkout" ? "/checkout" : "/"}
        right={credit ? <span className="rounded-full bg-sand px-2 py-0.5 text-xs">เครดิตเหลือ {baht(creditLeft)}</span> : undefined}
      />
      <ItemForm
        kind="WELFARE"
        mode={credit ? "CREDIT" : "FIXED"}
        product={{
          id: product.id,
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          price: product.price,
          sizes: product.sizes,
          lengths: product.lengths,
          creditAllowed: product.creditAllowed,
        }}
        entitled={entitled}
        creditLeft={creditLeft}
        initial={cart ? { size: cart.size, length: cart.length, quantity: cart.quantity, note: cart.note } : null}
        next={next}
      />
    </>
  );
}
