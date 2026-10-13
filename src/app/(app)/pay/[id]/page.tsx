import QRCode from "qrcode";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { baht } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/portal-labels";
import { payments } from "@/lib/providers/payment";
import { OMISE_BANKS } from "@/lib/providers/omise";
import { settleOmiseCharge, type ChargeResult } from "@/lib/payments";
import { requireEmployee } from "@/lib/session";
import { Card, Input, TopBar } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { simulatePayment } from "../../actions";
import { AutoRefresh, BankPicker, CardForm, NewQrButton } from "./omise-forms";

export default async function PayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ failed?: string }> }) {
  const { id } = await params;
  const { failed } = await searchParams;
  const emp = await requireEmployee();
  const payment = await db.payment.findFirst({ where: { id, order: { employeeId: emp.id } }, include: { order: true } });
  if (!payment) notFound();
  if (payment.status === "PAID") redirect(`/orders/${payment.orderId}`);
  const provider = payments();
  if (provider.name === "omise" && payment.provider === "omise") return <OmisePay payment={payment} failed={!!failed} />;
  const qr =
    payment.method === "PROMPTPAY" || payment.method === "MOBILE_BANKING"
      ? await QRCode.toDataURL(`MOCK-PROMPTPAY|SONGSMAI|${payment.amount.toFixed(2)}|${payment.id}`, { margin: 1, width: 220 })
      : null;

  return (
    <>
      <TopBar title="ชำระเงิน" back={`/orders/${payment.orderId}`} />
      <main className="space-y-3 px-4 py-4">
        <Card className="p-4 text-center">
          <p className="text-sm text-muted">คำสั่งซื้อ {payment.order.orderNumber} · {PAYMENT_METHOD_LABEL[payment.method]}</p>
          <p className="mt-1 text-3xl font-medium">{baht(payment.amount)}</p>
        </Card>
        {qr ? (
          <Card className="flex flex-col items-center gap-2 p-4">
            <p className="font-medium">{payment.method === "PROMPTPAY" ? "สแกนจ่ายด้วย PromptPay" : "สแกนหรือเปิดแอปธนาคารเพื่อชำระ"}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="PromptPay QR" width={220} height={220} />
            <p className="text-xs text-muted">ผู้รับเงิน: Songsmai · อ้างอิง {payment.providerRef}</p>
          </Card>
        ) : (
          <Card className="space-y-2 p-4">
            <p className="font-medium">{PAYMENT_METHOD_LABEL[payment.method]}</p>
            <Input placeholder="หมายเลขบัตร" disabled />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="MM/YY" disabled />
              <Input placeholder="CVV" disabled />
            </div>
          </Card>
        )}
        {provider.simulated && (
          <div className="rounded-lg border border-accent/30 bg-accent-50 p-3 text-sm text-accent">
            <p className="font-medium">โหมดทดสอบ</p>
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

type PaymentWithOrder = NonNullable<Awaited<ReturnType<typeof db.payment.findFirst<{ include: { order: true } }>>>>;

async function OmisePay({ payment, failed }: { payment: PaymentWithOrder; failed: boolean }) {
  let charge: ChargeResult | null = null;
  if (payment.providerRef) {
    charge = await settleOmiseCharge(payment.providerRef).catch((e) => {
      console.error(e);
      return { state: "failed" as const, message: "เชื่อมต่อระบบชำระเงินไม่สำเร็จ กรุณาลองใหม่" };
    });
    if (charge.state === "paid") redirect(`/orders/${payment.orderId}?done=1`);
  }
  const isCard = payment.method === "CREDIT_CARD" || payment.method === "DEBIT_CARD";
  const message = charge?.state === "failed" ? charge.message : failed ? "การชำระเงินไม่สำเร็จ กรุณาลองใหม่" : null;
  const qr = payment.method === "PROMPTPAY" && charge?.state === "pending" ? charge.qrImage : undefined;

  return (
    <>
      <TopBar title="ชำระเงิน" back={`/orders/${payment.orderId}`} />
      <main className="space-y-3 px-4 py-4">
        <Card className="p-4 text-center">
          <p className="text-sm text-muted">คำสั่งซื้อ {payment.order.orderNumber} · {PAYMENT_METHOD_LABEL[payment.method]}</p>
          <p className="mt-1 text-3xl font-medium">{baht(payment.amount)}</p>
        </Card>
        {message && (
          <p role="alert" className="rounded-lg bg-bad-50 px-3 py-2 text-sm text-bad">
            {message}
          </p>
        )}
        <Card className="p-4">
          {payment.method === "PROMPTPAY" &&
            (qr ? (
              <div className="flex flex-col items-center gap-2">
                <p className="font-medium">สแกนจ่ายด้วย PromptPay</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="PromptPay QR" width={240} height={240} />
                <p className="text-xs text-muted">หน้านี้จะอัปเดตเองเมื่อชำระเงินสำเร็จ</p>
                <AutoRefresh />
              </div>
            ) : (
              <NewQrButton paymentId={payment.id} />
            ))}
          {payment.method === "MOBILE_BANKING" && <BankPicker paymentId={payment.id} banks={OMISE_BANKS} />}
          {isCard &&
            (process.env.OMISE_PUBLIC_KEY ? (
              <CardForm paymentId={payment.id} publicKey={process.env.OMISE_PUBLIC_KEY} />
            ) : (
              <p className="text-sm text-bad">ยังไม่ได้ตั้งค่า OMISE_PUBLIC_KEY</p>
            ))}
        </Card>
        {process.env.OMISE_SECRET_KEY?.startsWith("skey_test_") && (
          <p className="rounded-lg border border-accent/30 bg-accent-50 p-3 text-xs text-accent">
            โหมดทดสอบ Omise: ไม่มีการตัดเงินจริง ใช้บัตรทดสอบ 4242 4242 4242 4242 หรือกด &ldquo;Mark as paid&rdquo; ใน Omise Dashboard สำหรับ PromptPay
          </p>
        )}
      </main>
    </>
  );
}
