import Link from "next/link";
import { requireEmployee } from "@/lib/session";
import { pricedPersonalCart } from "@/lib/portal";
import { getSettings } from "@/lib/settings";
import { Card, LinkButton, TopBar } from "@/components/ui";
import { PersonalCheckoutForm } from "./form";

export default async function PersonalCartPage() {
  const emp = await requireEmployee();
  const [{ lines }, settings] = await Promise.all([pricedPersonalCart(emp), getSettings()]);
  return (
    <>
      <TopBar title="ตะกร้า · Personal Order" back="/store" />
      {lines.length === 0 ? (
        <main className="space-y-3 px-4 py-6 text-center">
          <Card className="p-6 text-sm text-muted">ตะกร้ายังว่างอยู่</Card>
          <LinkButton href="/store">เลือกซื้อสินค้า</LinkButton>
        </main>
      ) : (
        <PersonalCheckoutForm
          lines={lines.map((l) => ({
            productId: l.productId,
            name: l.product.name,
            size: l.size,
            length: l.length,
            quantity: l.quantity,
            lineTotal: l.lineTotal,
          }))}
          homeDeliveryFee={settings.homeDeliveryFee}
          workLocation={emp.workLocation}
          homeAddress={emp.homeAddress ?? ""}
        />
      )}
      <p className="pb-20 text-center text-xs text-muted">
        <Link href="/store">เลือกซื้อสินค้าต่อ</Link>
      </p>
    </>
  );
}
