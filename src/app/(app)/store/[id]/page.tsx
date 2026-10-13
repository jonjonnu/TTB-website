import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireEmployee } from "@/lib/session";
import { TopBar } from "@/components/ui";
import { ItemForm } from "../../items/[id]/item-form";

export default async function StoreItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ id }, { next }] = await Promise.all([params, searchParams]);
  const emp = await requireEmployee();
  const product = await db.product.findUnique({ where: { id } });
  if (!product || !product.active || !product.personalSale) notFound();
  const cart = await db.cartItem.findFirst({ where: { employeeId: emp.id, kind: "PERSONAL", productId: id } });
  return (
    <>
      <TopBar title="ร้านค้า · Personal Order" back={next === "cart" ? "/store/cart" : "/store"} />
      <ItemForm
        kind="PERSONAL"
        mode="PERSONAL"
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
        entitled={0}
        creditLeft={0}
        initial={cart ? { size: cart.size, length: cart.length, quantity: cart.quantity, note: cart.note } : null}
        next={next}
      />
    </>
  );
}
