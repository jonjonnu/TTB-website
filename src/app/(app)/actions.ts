"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { baht, thDateTime } from "@/lib/format";
import { notifyEmployee } from "@/lib/notify";
import { canOrder, computeTotals, currentRound, nextOrderNumber, pricedCart } from "@/lib/portal";
import { payments } from "@/lib/providers/payment";
import { requireEmployee } from "@/lib/session";
import type { ActionState } from "@/components/forms";

async function openRoundFor(emp: Awaited<ReturnType<typeof requireEmployee>>) {
  const view = await currentRound(emp.department);
  const existing = view
    ? await db.order.findUnique({ where: { employeeId_roundId: { employeeId: emp.id, roundId: view.round.id } } })
    : null;
  if (!view || !canOrder(view, emp, !!existing)) return null;
  return { view, existing };
}

const cartSchema = z.object({
  productId: z.string().min(1),
  size: z.string().min(1, "กรุณาเลือกไซส์"),
  length: z.string().optional(),
  quantity: z.coerce.number().int().min(1).max(20),
  note: z.string().max(300).optional(),
  next: z.string().optional(),
});

export async function saveCartItem(_: ActionState, form: FormData): Promise<ActionState> {
  const emp = await requireEmployee();
  const parsed = cartSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ctx = await openRoundFor(emp);
  if (!ctx) return { error: "ขณะนี้ไม่ได้เปิดรับคำสั่งซื้อ" };
  const product = await db.product.findUnique({ where: { id: parsed.data.productId } });
  if (!product || !product.active) return { error: "ไม่พบสินค้า" };
  if (!product.sizes.includes(parsed.data.size)) return { error: "ไซส์ไม่ถูกต้อง" };
  if (product.lengths.length > 0 && !product.lengths.includes(parsed.data.length ?? "")) return { error: "กรุณาเลือกความยาว" };

  const data = {
    size: parsed.data.size,
    length: product.lengths.length > 0 ? parsed.data.length! : null,
    quantity: parsed.data.quantity,
    note: parsed.data.note || null,
  };
  await db.cartItem.upsert({
    where: { employeeId_roundId_productId: { employeeId: emp.id, roundId: ctx.view.round.id, productId: product.id } },
    create: { employeeId: emp.id, roundId: ctx.view.round.id, productId: product.id, ...data },
    update: data,
  });
  revalidatePath("/");
  redirect(parsed.data.next === "checkout" ? "/checkout" : "/");
}

export async function removeCartItem(form: FormData) {
  const emp = await requireEmployee();
  await db.cartItem.deleteMany({ where: { employeeId: emp.id, productId: String(form.get("productId")) } });
  revalidatePath("/");
  redirect(form.get("next") === "checkout" ? "/checkout" : "/");
}

/** Copy a confirmed order back into the cart so it can be changed. */
export async function startEdit(form: FormData) {
  const emp = await requireEmployee();
  const order = await db.order.findFirst({
    where: { id: String(form.get("orderId")), employeeId: emp.id },
    include: { items: true },
  });
  if (!order) redirect("/orders");
  const ctx = await openRoundFor(emp);
  if (!ctx || ctx.view.round.id !== order.roundId) redirect(`/orders/${order.id}`);
  await db.$transaction([
    db.cartItem.deleteMany({ where: { employeeId: emp.id, roundId: order.roundId } }),
    db.cartItem.createMany({
      data: order.items.map((i) => ({
        employeeId: emp.id,
        roundId: order.roundId,
        productId: i.productId,
        size: i.size,
        length: i.length,
        quantity: i.quantity,
        note: i.note,
      })),
    }),
  ]);
  redirect("/checkout");
}

export async function discardEdit() {
  const emp = await requireEmployee();
  const view = await currentRound(emp.department);
  if (view) await db.cartItem.deleteMany({ where: { employeeId: emp.id, roundId: view.round.id } });
  redirect("/");
}

const checkoutSchema = z.object({
  deliveryMethod: z.enum(["BRANCH", "HOME"]),
  branchId: z.string().optional(),
  homeAddress: z.string().max(500).optional(),
  paymentMethod: z.enum(["PROMPTPAY", "CARD"]).optional(),
});

export async function placeOrder(_: ActionState, form: FormData): Promise<ActionState> {
  const emp = await requireEmployee();
  const parsed = checkoutSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "ข้อมูลไม่ครบ" };
  const input = parsed.data;
  const ctx = await openRoundFor(emp);
  if (!ctx) return { error: "ขณะนี้ไม่ได้เปิดรับคำสั่งซื้อหรือแก้ไขคำสั่งซื้อ" };
  const { view, existing } = ctx;
  const round = view.round;

  const { lines } = await pricedCart(emp, round.id);
  if (lines.length === 0) return { error: "ยังไม่ได้เลือกรายการ" };
  if (input.deliveryMethod === "BRANCH" && !input.branchId) return { error: "กรุณาเลือกสาขาที่รับ" };
  if (input.deliveryMethod === "HOME" && !input.homeAddress?.trim()) return { error: "กรุณากรอกที่อยู่สำหรับจัดส่ง" };

  const deliveryFee = input.deliveryMethod === "HOME" ? round.homeDeliveryFee : 0;
  const totals = computeTotals(lines, deliveryFee);
  const amountPaid = existing?.amountPaid ?? 0;
  const due = totals.total - amountPaid;
  if (due > 0 && !input.paymentMethod) return { error: "กรุณาเลือกวิธีชำระเงิน" };

  const paymentStatus = due > 0 ? "PENDING" : due < 0 ? "REFUND_DUE" : totals.total === 0 ? "NOT_REQUIRED" : "PAID";
  const orderData = {
    deliveryMethod: input.deliveryMethod,
    branchId: input.deliveryMethod === "BRANCH" ? input.branchId! : null,
    homeAddress: input.deliveryMethod === "HOME" ? input.homeAddress!.trim() : null,
    extrasTotal: totals.extrasTotal,
    deliveryFee,
    total: totals.total,
    paymentStatus,
    paymentMethod: due > 0 ? input.paymentMethod! : (existing?.paymentMethod ?? null),
  } as const;
  const itemRows = lines.map((l) => ({
    productId: l.productId,
    size: l.size,
    length: l.length,
    quantity: l.quantity,
    entitledQty: l.entitledQty,
    extraQty: l.extraQty,
    unitPrice: l.unitPrice,
    note: l.note,
  }));

  const order = await db.$transaction(async (tx) => {
    let o;
    if (existing) {
      await tx.orderItem.deleteMany({ where: { orderId: existing.id } });
      o = await tx.order.update({
        where: { id: existing.id },
        data: { ...orderData, editCount: { increment: 1 }, items: { create: itemRows } },
      });
      await tx.orderEvent.create({ data: { orderId: o.id, message: "แก้ไขคำสั่งซื้อ" } });
    } else {
      o = await tx.order.create({
        data: {
          ...orderData,
          orderNumber: await nextOrderNumber(round),
          employeeId: emp.id,
          roundId: round.id,
          items: { create: itemRows },
          events: { create: { status: "PLACED", message: "สั่งคำสั่งซื้อแล้ว" } },
        },
      });
    }
    await tx.cartItem.deleteMany({ where: { employeeId: emp.id, roundId: round.id } });
    if (input.deliveryMethod === "HOME" && !emp.homeAddress) {
      await tx.employee.update({ where: { id: emp.id }, data: { homeAddress: input.homeAddress!.trim() } });
    }
    return o;
  });

  if (due > 0) {
    const payment = await db.payment.create({
      data: { orderId: order.id, amount: due, method: input.paymentMethod!, provider: payments().name },
    });
    const session = await payments().createSession({ paymentId: payment.id, amount: due, method: input.paymentMethod! });
    await db.payment.update({ where: { id: payment.id }, data: { providerRef: session.providerRef } });
    redirect(`/pay/${payment.id}`);
  }

  await notifyEmployee(emp.id, {
    kind: existing ? "ORDER_EDITED" : "ORDER_CONFIRMED",
    title: existing ? "แก้ไขคำสั่งซื้อแล้ว" : "ยืนยันคำสั่งซื้อ",
    body: `${order.orderNumber}: ${existing ? "บันทึกการแก้ไขแล้ว" : "ได้รับคำสั่งซื้อของคุณแล้ว"} แก้ไขได้ถึง ${thDateTime(view.closeAt)} น.${
      due < 0 ? ` ส่วนต่าง ${baht(-due)} จะคืนให้ภายหลัง` : ""
    }`,
    href: `/orders/${order.id}`,
  });
  redirect(`/orders/${order.id}?done=1`);
}

/** Mock provider only: the tester confirms the payment themselves. A real gateway would call this from its webhook. */
export async function simulatePayment(form: FormData) {
  const emp = await requireEmployee();
  if (!payments().simulated) throw new Error("Payment confirmation must come from the payment provider");
  const payment = await db.payment.findFirst({
    where: { id: String(form.get("paymentId")), order: { employeeId: emp.id } },
    include: { order: true },
  });
  if (!payment) redirect("/orders");
  if (payment.status !== "PAID") await markPaymentPaid(payment.id);
  redirect(`/orders/${payment.orderId}?done=1`);
}

async function markPaymentPaid(paymentId: string) {
  const payment = await db.payment.update({
    where: { id: paymentId },
    data: { status: "PAID", paidAt: new Date() },
    include: { order: true },
  });
  const order = await db.order.update({
    where: { id: payment.orderId },
    data: { amountPaid: { increment: payment.amount } },
  });
  const settled = order.amountPaid >= order.total;
  await db.order.update({ where: { id: order.id }, data: { paymentStatus: settled ? "PAID" : "PENDING" } });
  await db.orderEvent.create({ data: { orderId: order.id, message: `ชำระเงิน ${baht(payment.amount)}` } });
  await notifyEmployee(order.employeeId, {
    kind: "PAYMENT",
    title: "ชำระเงินสำเร็จ",
    body: `ชำระ ${baht(payment.amount)} สำหรับคำสั่งซื้อ ${order.orderNumber} เรียบร้อยแล้ว`,
    href: `/orders/${order.id}`,
  });
  await notifyEmployee(order.employeeId, {
    kind: order.editCount > 0 ? "ORDER_EDITED" : "ORDER_CONFIRMED",
    title: order.editCount > 0 ? "แก้ไขคำสั่งซื้อแล้ว" : "ยืนยันคำสั่งซื้อ",
    body: `${order.orderNumber}: ได้รับคำสั่งซื้อของคุณแล้ว`,
    href: `/orders/${order.id}`,
  });
}

export async function markAllRead() {
  const emp = await requireEmployee();
  await db.notification.updateMany({ where: { employeeId: emp.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
}

export async function savePreferences(form: FormData) {
  const emp = await requireEmployee();
  await db.employee.update({
    where: { id: emp.id },
    data: {
      notifyEmail: form.get("notifyEmail") === "on",
      notifySms: form.get("notifySms") === "on",
      notifyLine: form.get("notifyLine") === "on",
    },
  });
  revalidatePath("/notifications");
  revalidatePath("/account");
}

export async function saveAddress(_: ActionState, form: FormData): Promise<ActionState> {
  const emp = await requireEmployee();
  const address = String(form.get("homeAddress") ?? "").trim().slice(0, 500);
  await db.employee.update({ where: { id: emp.id }, data: { homeAddress: address || null } });
  revalidatePath("/account");
  return { ok: "บันทึกที่อยู่แล้ว" };
}

export async function changePassword(_: ActionState, form: FormData): Promise<ActionState> {
  const emp = await requireEmployee();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("password") ?? "");
  if (!emp.passwordHash || !(await bcrypt.compare(current, emp.passwordHash))) return { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
  if (next.length < 8) return { error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
  if (next !== form.get("confirm")) return { error: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" };
  await db.employee.update({ where: { id: emp.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  return { ok: "เปลี่ยนรหัสผ่านแล้ว" };
}
