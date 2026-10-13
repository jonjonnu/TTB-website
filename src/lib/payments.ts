import "server-only";
import { db } from "@/lib/db";
import { baht } from "@/lib/format";
import { notifyEmployee } from "@/lib/notify";
import { chargeMatches, getCharge } from "@/lib/providers/omise";

/** Records a payment as paid once. Safe to call again for the same payment (webhook + return page). */
export async function markPaymentPaid(paymentId: string) {
  const claimed = await db.payment.updateMany({ where: { id: paymentId, status: { not: "PAID" } }, data: { status: "PAID", paidAt: new Date() } });
  if (claimed.count === 0) return;
  const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  const order = await db.order.update({
    where: { id: payment.orderId },
    data: { amountPaid: { increment: payment.amount } },
  });
  const settled = order.amountPaid >= order.total;
  await db.order.update({ where: { id: order.id }, data: { paymentStatus: settled ? "PAID" : "PENDING" } });
  await db.orderEvent.create({ data: { orderId: order.id, message: `ชำระเงิน ${baht(payment.amount)}` } });
  await notifyEmployee(order.employeeId, {
    kind: order.editCount > 0 ? "ORDER_EDITED" : "ORDER_CONFIRMED",
    title: order.editCount > 0 ? "แก้ไขคำสั่งซื้อแล้ว" : "ยืนยันคำสั่งซื้อ",
    body: `${order.orderNumber} ยืนยันแล้ว ชำระ ${baht(payment.amount)} สำเร็จ`,
    href: `/orders/${order.id}`,
  });
}

export type ChargeResult =
  | { state: "paid"; orderId: string }
  | { state: "pending"; qrImage?: string; authorizeUri?: string | null }
  | { state: "failed"; message: string };

/**
 * Asks Omise for the charge's real status (never trusts a webhook body or a redirect)
 * and marks the payment paid when the charge succeeded for the right payment and amount.
 */
export async function settleOmiseCharge(chargeId: string): Promise<ChargeResult & { paymentId?: string }> {
  const charge = await getCharge(chargeId);
  const paymentId = charge.metadata?.paymentId;
  const payment = paymentId ? await db.payment.findUnique({ where: { id: paymentId } }) : null;
  if (!payment || payment.provider !== "omise" || !chargeMatches(charge, payment)) {
    return { state: "failed", message: "ข้อมูลการชำระเงินไม่ตรงกัน" };
  }
  if (charge.status === "successful" && charge.paid) {
    await markPaymentPaid(payment.id);
    return { state: "paid", orderId: payment.orderId, paymentId: payment.id };
  }
  if (charge.status === "pending") {
    return {
      state: "pending",
      paymentId: payment.id,
      qrImage: charge.source?.scannable_code?.image?.download_uri,
      authorizeUri: charge.authorize_uri,
    };
  }
  return { state: "failed", paymentId: payment.id, message: charge.failure_message ?? "การชำระเงินไม่สำเร็จ หรือหมดเวลาแล้ว" };
}
