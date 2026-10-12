"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { baht, thDateTime } from "@/lib/format";
import { notifyEmployee } from "@/lib/notify";
import {
  benefitFor,
  canOrderWelfare,
  employeeEntitlements,
  inDepartmentCatalog,
  nextOrderNumber,
  pricedPersonalCart,
  pricedWelfareCart,
  welfareRoundFor,
} from "@/lib/portal";
import { payments } from "@/lib/providers/payment";
import { requireEmployee } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import type { ActionState } from "@/components/forms";
import type { PaymentMethod } from "@prisma/client";

type Emp = Awaited<ReturnType<typeof requireEmployee>>;

async function openWelfareRound(emp: Emp) {
  const view = await welfareRoundFor(emp);
  const existing = view
    ? await db.order.findUnique({ where: { employeeId_roundId: { employeeId: emp.id, roundId: view.round.id } } })
    : null;
  if (!view || !canOrderWelfare(view, !!existing)) return null;
  return { view, existing };
}

function workplaceAddress(emp: Emp) {
  return [emp.workLocation, emp.workAddress].filter(Boolean).join(" · ") || null;
}

// ---------- cart ----------

const cartSchema = z.object({
  kind: z.enum(["WELFARE", "PERSONAL"]),
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
  const input = parsed.data;
  const product = await db.product.findUnique({ where: { id: input.productId } });
  if (!product || !product.active) return { error: "ไม่พบสินค้า" };
  if (!product.sizes.includes(input.size)) return { error: "ไซส์ไม่ถูกต้อง" };
  if (product.lengths.length > 0 && !product.lengths.includes(input.length ?? "")) return { error: "กรุณาเลือกความยาว" };

  let roundId: string | null = null;
  if (input.kind === "WELFARE") {
    const ctx = await openWelfareRound(emp);
    if (!ctx) return { error: "ขณะนี้ไม่ได้เปิดรับคำสั่งซื้อ" };
    const benefit = benefitFor(ctx.view.round, emp.department);
    const allowed =
      inDepartmentCatalog(product, emp.department) ||
      (benefit.mode === "FIXED" && (await employeeEntitlements(emp, ctx.view.round.opensAt)).has(product.id));
    if (!allowed) return { error: "สินค้านี้ไม่อยู่ในสิทธิ์ของคุณ สั่งได้ที่ร้านค้า (Personal Order)" };
    roundId = ctx.view.round.id;
  } else if (!product.personalSale) {
    return { error: "สินค้านี้ไม่ได้เปิดขายส่วนตัว" };
  }

  const data = {
    size: input.size,
    length: product.lengths.length > 0 ? input.length! : null,
    quantity: input.quantity,
    note: input.note || null,
  };
  const existing = await db.cartItem.findFirst({ where: { employeeId: emp.id, kind: input.kind, roundId, productId: product.id } });
  if (existing) await db.cartItem.update({ where: { id: existing.id }, data });
  else await db.cartItem.create({ data: { employeeId: emp.id, kind: input.kind, roundId, productId: product.id, ...data } });

  revalidatePath("/");
  if (input.kind === "PERSONAL") redirect(input.next === "cart" ? "/store/cart" : "/store?added=1");
  redirect(input.next === "checkout" ? "/checkout" : "/");
}

export async function removeCartItem(form: FormData) {
  const emp = await requireEmployee();
  const kind = form.get("kind") === "PERSONAL" ? "PERSONAL" : "WELFARE";
  await db.cartItem.deleteMany({ where: { employeeId: emp.id, kind, productId: String(form.get("productId")) } });
  revalidatePath("/");
  const next = form.get("next");
  redirect(next === "checkout" ? "/checkout" : next === "cart" ? "/store/cart" : kind === "PERSONAL" ? "/store" : "/");
}

/** Copy a confirmed welfare order back into the cart so it can be changed. */
export async function startEdit(form: FormData) {
  const emp = await requireEmployee();
  const order = await db.order.findFirst({
    where: { id: String(form.get("orderId")), employeeId: emp.id, kind: "WELFARE" },
    include: { items: true },
  });
  if (!order) redirect("/orders");
  const ctx = await openWelfareRound(emp);
  if (!ctx || ctx.view.round.id !== order.roundId) redirect(`/orders/${order.id}`);
  await db.$transaction([
    db.cartItem.deleteMany({ where: { employeeId: emp.id, kind: "WELFARE", roundId: order.roundId } }),
    db.cartItem.createMany({
      data: order.items.map((i) => ({
        employeeId: emp.id,
        kind: "WELFARE" as const,
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
  const view = await welfareRoundFor(emp);
  if (view) await db.cartItem.deleteMany({ where: { employeeId: emp.id, kind: "WELFARE", roundId: view.round.id } });
  redirect("/");
}

// ---------- checkout ----------

const paymentMethod = z.enum(["PROMPTPAY", "MOBILE_BANKING", "CREDIT_CARD", "DEBIT_CARD"]).optional();

async function startPayment(orderId: string, amount: number, method: PaymentMethod) {
  const payment = await db.payment.create({ data: { orderId, amount, method, provider: payments().name } });
  const session = await payments().createSession({ paymentId: payment.id, amount, method });
  await db.payment.update({ where: { id: payment.id }, data: { providerRef: session.providerRef } });
  redirect(`/pay/${payment.id}`);
}

export async function placeWelfareOrder(_: ActionState, form: FormData): Promise<ActionState> {
  const emp = await requireEmployee();
  const method = paymentMethod.safeParse(form.get("paymentMethod") || undefined);
  if (!method.success) return { error: "วิธีชำระเงินไม่ถูกต้อง" };
  const ctx = await openWelfareRound(emp);
  if (!ctx) return { error: "ขณะนี้ไม่ได้เปิดรับคำสั่งซื้อหรือแก้ไขคำสั่งซื้อ" };
  const { view, existing } = ctx;
  const round = view.round;

  const { lines, totals, benefit } = await pricedWelfareCart(emp, view);
  if (lines.length === 0) return { error: "ยังไม่ได้เลือกรายการ" };
  const amountPaid = existing?.amountPaid ?? 0;
  const due = totals.total - amountPaid;
  if (due > 0 && !method.data) return { error: "กรุณาเลือกวิธีชำระส่วนเกิน" };

  const paymentStatus = due > 0 ? "PENDING" : due < 0 ? "REFUND_DUE" : totals.total === 0 ? "NOT_REQUIRED" : "PAID";
  const orderData = {
    benefitMode: benefit.mode,
    deliveryMethod: "WORKPLACE" as const,
    deliveryAddress: workplaceAddress(emp),
    subtotal: totals.subtotal,
    creditUsed: totals.creditUsed,
    deliveryFee: 0,
    total: totals.total,
    paymentStatus,
    paymentMethod: due > 0 ? method.data! : (existing?.paymentMethod ?? null),
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
          kind: "WELFARE",
          orderNumber: await nextOrderNumber("WELFARE", round),
          employeeId: emp.id,
          roundId: round.id,
          items: { create: itemRows },
          events: { create: { status: "PLACED", message: "ยืนยันคำสั่งซื้อ" } },
        },
      });
    }
    await tx.cartItem.deleteMany({ where: { employeeId: emp.id, kind: "WELFARE", roundId: round.id } });
    return o;
  });

  if (due > 0) await startPayment(order.id, due, method.data!);

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

const personalSchema = z.object({
  deliveryMethod: z.enum(["WORKPLACE", "HOME"]),
  homeAddress: z.string().max(500).optional(),
  paymentMethod,
});

export async function placePersonalOrder(_: ActionState, form: FormData): Promise<ActionState> {
  const emp = await requireEmployee();
  const parsed = personalSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "ข้อมูลไม่ครบ" };
  const input = parsed.data;
  if (input.deliveryMethod === "HOME" && !input.homeAddress?.trim()) return { error: "กรุณากรอกที่อยู่สำหรับจัดส่ง" };
  if (!input.paymentMethod) return { error: "กรุณาเลือกวิธีชำระเงิน" };
  const { homeDeliveryFee } = await getSettings();
  const { lines, totals } = await pricedPersonalCart(emp, input.deliveryMethod === "HOME" ? homeDeliveryFee : 0);
  if (lines.length === 0) return { error: "ตะกร้ายังว่างอยู่" };

  const order = await db.$transaction(async (tx) => {
    const o = await tx.order.create({
      data: {
        kind: "PERSONAL",
        orderNumber: await nextOrderNumber("PERSONAL"),
        employeeId: emp.id,
        deliveryMethod: input.deliveryMethod,
        deliveryAddress: input.deliveryMethod === "HOME" ? input.homeAddress!.trim() : workplaceAddress(emp),
        subtotal: totals.subtotal,
        deliveryFee: totals.deliveryFee,
        total: totals.total,
        paymentStatus: "PENDING",
        paymentMethod: input.paymentMethod,
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            size: l.size,
            length: l.length,
            quantity: l.quantity,
            entitledQty: 0,
            extraQty: l.quantity,
            unitPrice: l.unitPrice,
            note: l.note,
          })),
        },
        events: { create: { status: "PLACED", message: "สั่งซื้อ (รอชำระเงิน)" } },
      },
    });
    await tx.cartItem.deleteMany({ where: { employeeId: emp.id, kind: "PERSONAL" } });
    if (input.deliveryMethod === "HOME" && !emp.homeAddress) {
      await tx.employee.update({ where: { id: emp.id }, data: { homeAddress: input.homeAddress!.trim() } });
    }
    return o;
  });
  await startPayment(order.id, order.total, input.paymentMethod);
  return undefined;
}

/** Mock provider only: the tester confirms the payment themselves. A real gateway would call this from its webhook. */
export async function simulatePayment(form: FormData) {
  const emp = await requireEmployee();
  if (!payments().simulated) throw new Error("Payment confirmation must come from the payment provider");
  const payment = await db.payment.findFirst({
    where: { id: String(form.get("paymentId")), order: { employeeId: emp.id } },
  });
  if (!payment) redirect("/orders");
  if (payment.status !== "PAID") await markPaymentPaid(payment.id);
  redirect(`/orders/${payment.orderId}?done=1`);
}

async function markPaymentPaid(paymentId: string) {
  const payment = await db.payment.update({ where: { id: paymentId }, data: { status: "PAID", paidAt: new Date() } });
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

// ---------- after-sales ----------

export async function requestExchange(_: ActionState, form: FormData): Promise<ActionState> {
  const emp = await requireEmployee();
  const reason = z.enum(["WRONG_SIZE", "DEFECT", "WRONG_ITEM"]).safeParse(form.get("reason"));
  const details = String(form.get("details") ?? "").trim();
  if (!reason.success) return { error: "กรุณาเลือกเหตุผล" };
  if (details.length < 3) return { error: "กรุณาระบุรายละเอียด เช่น สินค้าและไซส์ที่ต้องการ" };
  const order = await db.order.findFirst({ where: { id: String(form.get("orderId")), employeeId: emp.id } });
  if (!order) return { error: "ไม่พบคำสั่งซื้อ" };
  await db.exchangeRequest.create({ data: { orderId: order.id, employeeId: emp.id, reason: reason.data, details: details.slice(0, 1000) } });
  await notifyEmployee(emp.id, {
    kind: "EXCHANGE",
    title: "ได้รับคำขอเปลี่ยนสินค้า",
    body: `${order.orderNumber}: ทีม Songsmai จะติดต่อกลับภายใน 3 วันทำการ`,
    href: `/orders/${order.id}`,
  });
  redirect(`/orders/${order.id}`);
}

// ---------- account ----------

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
