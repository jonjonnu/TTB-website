import QRCode from "qrcode";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { baht } from "@/lib/format";
import { payments } from "@/lib/providers/payment";
import { requireEmployee } from "@/lib/session";
import { Card, Input, TopBar } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { simulatePayment } from "../../actions";

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const emp = await requireEmployee();
  const payment = await db.payment.findFirst({ where: { id, order: { employeeId: emp.id } }, include: { order: true } });
  if (!payment) notFound();
  if (payment.status === "PAID") redirect(`/orders/${payment.orderId}`);
  const provider = payments();
  const qr =
    payment.method === "PROMPTPAY"
      ? await QRCode.toDataURL(`MOCK-PROMPTPAY|SONGSMAI|${payment.amount.toFixed(2)}|${payment.id}`, { margin: 1, width: 220 })
      : null;

  return (
    <>
      <TopBar title="ชำระเงิน" back={`/orders/${payment.orderId}`} />
      <main className="space-y-3 px-4 py-4">
        <Card className="p-4 text-center">
          <p className="text-sm text-muted">คำสั่งซื้อ {payment.order.orderNumber}</p>
          <p className="mt-1 text-3xl font-bold">{baht(payment.amount)}</p>
        </Card>
        {qr ? (
          <Card className="flex flex-col items-center gap-2 p-4">
            <p className="font-semibold">สแกนจ่ายด้วย PromptPay</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="PromptPay QR" width={220} height={220} />
            <p className="text-xs text-muted">ผู้รับเงิน: Songsmai · อ้างอิง {payment.providerRef}</p>
          </Card>
        ) : (
          <Card className="space-y-2 p-4">
            <p className="font-semibold">บัตรเครดิต / เดบิต</p>
            <Input placeholder="หมายเลขบัตร" disabled />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="MM/YY" disabled />
              <Input placeholder="CVV" disabled />
            </div>
          </Card>
        )}
        {provider.simulated && (
          <div className="rounded-lg border border-accent/30 bg-accent-50 p-3 text-sm text-[#8a4b0f]">
            <p className="font-semibold">โหมดทดสอบ</p>
            <p className="mt-0.5 text-xs">ยังไม่ได้เชื่อมระบบรับเงินจริง QR นี้ใช้จ่ายไม่ได้ กดปุ่มด้านล่างเพื่อจำลองว่าชำระเงินสำเร็จ</p>
            <form action={simulatePayment} className="mt-2">
              <input type="hidden" name="paymentId" value={payment.id} />
              <SubmitButton className="w-full">จำลองการชำระเงินสำเร็จ</SubmitButton>
            </form>
          </div>
        )}
      </main>
    </>
  );
}
