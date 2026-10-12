import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireEmployee } from "@/lib/session";
import { canOrder, currentRound, employeeEntitlements } from "@/lib/portal";
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
  const product = await db.product.findUnique({ where: { id } });
  if (!product || !product.active) notFound();
  const view = await currentRound(emp.department);
  const order = view
    ? await db.order.findUnique({ where: { employeeId_roundId: { employeeId: emp.id, roundId: view.round.id } }, include: { items: true } })
    : null;
  if (!canOrder(view, emp, !!order)) redirect("/");
  const entitled = (await employeeEntitlements(emp)).get(product.id) ?? 0;
  const cart = await db.cartItem.findUnique({
    where: { employeeId_roundId_productId: { employeeId: emp.id, roundId: view!.round.id, productId: product.id } },
  });

  return (
    <>
      <TopBar title="รายละเอียดเครื่องแบบ" back={next === "checkout" ? "/checkout" : entitled ? "/" : "/shop"} />
      <ItemForm
        product={{
          id: product.id,
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          price: product.price,
          sizes: product.sizes,
          lengths: product.lengths,
        }}
        entitled={entitled}
        initial={cart ? { size: cart.size, length: cart.length, quantity: cart.quantity, note: cart.note } : null}
        next={next}
      />
    </>
  );
}
