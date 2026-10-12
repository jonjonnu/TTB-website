"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseCsvObjects } from "@/lib/csv";
import { fromLocalInput, thDateTime } from "@/lib/format";
import { notifyEmployee, notifyMany } from "@/lib/notify";
import { STATUS_LABEL } from "@/lib/portal";
import { DAY, roundLabel } from "@/lib/rounds";
import { endAdminSession, requireAdmin, startAdminSession } from "@/lib/session";
import { saveSettings } from "@/lib/settings";
import type { ActionState } from "@/components/forms";
import type { OrderStatus } from "@prisma/client";

// ---------- session ----------

export async function adminLogin(_: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const admin = await db.adminUser.findUnique({ where: { email } });
  if (!admin || !(await bcrypt.compare(String(form.get("password") ?? ""), admin.passwordHash))) {
    return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }
  await startAdminSession(admin.id);
  redirect("/admin");
}

export async function adminLogout() {
  await endAdminSession();
  redirect("/admin/login");
}

// ---------- employees ----------

const GENDER: Record<string, "MALE" | "FEMALE"> = { m: "MALE", male: "MALE", ชาย: "MALE", f: "FEMALE", female: "FEMALE", หญิง: "FEMALE" };

/** CSV columns: employee_code, first_name, last_name, gender, department, sub_department, position, manager, email, phone, branch_code */
export async function importEmployees(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "กรุณาเลือกไฟล์ CSV" };
  const rows = parseCsvObjects(await file.text());
  if (rows.length === 0) return { error: "ไม่พบข้อมูลในไฟล์" };
  const branches = new Map((await db.branch.findMany()).map((b) => [b.code, b.id]));
  const errors: string[] = [];
  let created = 0;
  let updated = 0;
  for (const [i, r] of rows.entries()) {
    const line = i + 2;
    const gender = GENDER[(r.gender ?? "").toLowerCase()];
    if (!r.employee_code || !r.first_name || !r.last_name || !gender || !r.department || !r.position) {
      errors.push(`แถว ${line}: ข้อมูลไม่ครบ (employee_code, first_name, last_name, gender, department, position)`);
      continue;
    }
    const data = {
      firstName: r.first_name,
      lastName: r.last_name,
      gender,
      department: r.department,
      subDepartment: r.sub_department || null,
      position: r.position,
      managerName: r.manager || null,
      email: r.email || null,
      phone: r.phone || null,
      branchId: r.branch_code ? (branches.get(r.branch_code) ?? null) : null,
    };
    const existing = await db.employee.findUnique({ where: { employeeCode: r.employee_code } });
    if (existing) {
      await db.employee.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await db.employee.create({ data: { employeeCode: r.employee_code, ...data } });
      created++;
    }
  }
  revalidatePath("/admin");
  const summary = `นำเข้าแล้ว: เพิ่มใหม่ ${created} คน อัปเดต ${updated} คน`;
  return errors.length ? { error: `${summary} · มีข้อผิดพลาด ${errors.length} แถว: ${errors.slice(0, 5).join(" / ")}` } : { ok: summary };
}

export async function setEmployeeActive(form: FormData) {
  await requireAdmin();
  await db.employee.update({ where: { id: String(form.get("id")) }, data: { active: form.get("active") === "true" } });
  revalidatePath("/admin");
}

// ---------- rounds ----------

export async function createRound(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const schema = z.object({
    year: z.coerce.number().int().min(2020).max(2100),
    roundNumber: z.coerce.number().int().min(1).max(12),
    opensAt: z.string().min(1),
    openDays: z.coerce.number().int().min(1).max(60),
    deliveryDays: z.coerce.number().int().min(1).max(180),
    homeDeliveryFee: z.coerce.number().int().min(0),
  });
  const p = schema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "ข้อมูลรอบไม่ถูกต้อง" };
  const opensAt = fromLocalInput(p.data.opensAt);
  // Close at 23:59 on the last open day.
  const lastDay = new Date(opensAt.getTime() + (p.data.openDays - 1) * DAY);
  const closesAt = fromLocalInput(`${lastDay.toISOString().slice(0, 10)}T23:59`);
  const exists = await db.orderRound.findUnique({ where: { year_roundNumber: { year: p.data.year, roundNumber: p.data.roundNumber } } });
  if (exists) return { error: "มีรอบนี้อยู่แล้ว" };
  await db.orderRound.create({
    data: {
      year: p.data.year,
      roundNumber: p.data.roundNumber,
      opensAt,
      closesAt,
      originalClosesAt: closesAt,
      deliveryDays: p.data.deliveryDays,
      homeDeliveryFee: p.data.homeDeliveryFee,
    },
  });
  revalidatePath("/admin/rounds");
  return { ok: "สร้างรอบใหม่แล้ว" };
}

export async function updateRound(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(form.get("id"));
  const round = await db.orderRound.findUnique({ where: { id } });
  if (!round) return { error: "ไม่พบรอบ" };
  const opensAt = fromLocalInput(String(form.get("opensAt")));
  const closesAt = fromLocalInput(String(form.get("closesAt")));
  if (closesAt <= opensAt) return { error: "วันปิดรับต้องหลังวันเปิดรับ" };
  await db.orderRound.update({
    where: { id },
    data: {
      opensAt,
      closesAt,
      // Before anyone has seen it, changing the close date isn't an "extension".
      originalClosesAt: round.opensAt > new Date() ? closesAt : undefined,
      allowEdits: form.get("allowEdits") === "on",
      homeDeliveryFee: Number(form.get("homeDeliveryFee") ?? round.homeDeliveryFee),
      deliveryDays: Number(form.get("deliveryDays") ?? round.deliveryDays),
    },
  });
  revalidatePath("/admin/rounds");
  return { ok: "บันทึกแล้ว" };
}

export async function extendRound(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(form.get("id"));
  const round = await db.orderRound.findUnique({ where: { id }, include: { extensions: true } });
  if (!round) return { error: "ไม่พบรอบ" };
  const newClosesAt = fromLocalInput(String(form.get("newClosesAt")));
  const scope = form.get("scope") === "ALL" ? "ALL" : "DEPARTMENT";
  const department = scope === "DEPARTMENT" ? String(form.get("scope")) : null;
  const reason = String(form.get("reason") ?? "").trim();
  if (!reason) return { error: "กรุณาระบุเหตุผล (แสดงในการแจ้งเตือนพนักงาน)" };
  const previous = round.closedEarlyAt ?? round.closesAt;
  if (newClosesAt <= previous && scope === "ALL") return { error: "วันปิดรับใหม่ต้องหลังวันปิดรับเดิม" };
  if (newClosesAt <= new Date()) return { error: "วันปิดรับใหม่ต้องเป็นเวลาในอนาคต" };

  await db.$transaction([
    db.roundExtension.create({
      data: { roundId: id, scope, department, previousClosesAt: previous, newClosesAt, reason, createdBy: admin.name },
    }),
    ...(scope === "ALL" ? [db.orderRound.update({ where: { id }, data: { closesAt: newClosesAt, closedEarlyAt: null } })] : []),
  ]);

  const targets = await db.employee.findMany({
    where: { active: true, registeredAt: { not: null }, ...(department ? { department } : {}) },
    select: { id: true },
  });
  await notifyMany(
    targets.map((t) => t.id),
    {
      kind: "EXTENSION",
      title: "ขยายเวลาสั่งซื้อ",
      body: `${roundLabel(round)} ขยายเวลาปิดรับเป็น ${thDateTime(newClosesAt)} น. · ${reason}`,
      href: "/",
      sendExternal: form.get("notify") === "on",
    },
  );
  revalidatePath("/admin/rounds");
  return { ok: `ขยายเวลาแล้ว แจ้งพนักงาน ${targets.length} คน` };
}

export async function closeRoundNow(form: FormData) {
  await requireAdmin();
  await db.orderRound.update({ where: { id: String(form.get("id")) }, data: { closedEarlyAt: new Date() } });
  revalidatePath("/admin/rounds");
}

export async function remindNotOrdered(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  const round = await db.orderRound.findUnique({ where: { id } });
  if (!round) return;
  const targets = await db.employee.findMany({
    where: { active: true, orders: { none: { roundId: id } } },
    select: { id: true },
  });
  await notifyMany(
    targets.map((t) => t.id),
    {
      kind: "REMINDER",
      title: "อย่าลืมสั่งเครื่องแบบ",
      body: `${roundLabel(round)} ปิดรับ ${thDateTime(round.closesAt)} น. เข้าระบบเพื่อเลือกไซส์ตามสิทธิ์ของคุณ`,
      href: "/",
    },
  );
  revalidatePath("/admin/rounds");
  redirect(`/admin/rounds?reminded=${targets.length}`);
}

export async function saveTimelineSettings(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const p = z
    .object({
      openDays: z.coerce.number().int().min(1).max(60),
      deliveryDays: z.coerce.number().int().min(1).max(180),
      homeDeliveryFee: z.coerce.number().int().min(0),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "ค่าไม่ถูกต้อง" };
  await saveSettings(p.data);
  revalidatePath("/admin/rounds");
  return { ok: "บันทึกแล้ว (ใช้กับรอบที่สร้างใหม่)" };
}

// ---------- entitlements & products ----------

export async function addRule(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const quantity = Number(form.get("quantity"));
  if (!form.get("productId") || !Number.isInteger(quantity) || quantity < 1) return { error: "กรุณาเลือกสินค้าและจำนวน" };
  const g = String(form.get("gender") ?? "");
  await db.entitlementRule.create({
    data: {
      productId: String(form.get("productId")),
      gender: g === "MALE" || g === "FEMALE" ? g : null,
      department: String(form.get("department") ?? "") || null,
      position: String(form.get("position") ?? "") || null,
      quantity,
    },
  });
  revalidatePath("/admin/entitlements");
  return { ok: "เพิ่มกฎแล้ว" };
}

export async function deleteRule(form: FormData) {
  await requireAdmin();
  await db.entitlementRule.delete({ where: { id: String(form.get("id")) } });
  revalidatePath("/admin/entitlements");
}

const list = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export async function saveProduct(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const p = z
    .object({
      id: z.string().optional(),
      sku: z.string().min(1, "กรุณากรอก SKU"),
      name: z.string().min(1, "กรุณากรอกชื่อสินค้า"),
      price: z.coerce.number().int().min(0),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
      sortOrder: z.coerce.number().int().optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const sizes = list(form.get("sizes"));
  if (sizes.length === 0) return { error: "กรุณาระบุไซส์ (คั่นด้วยจุลภาค)" };
  const data = {
    sku: p.data.sku,
    name: p.data.name,
    price: p.data.price,
    description: p.data.description || null,
    imageUrl: p.data.imageUrl || null,
    sortOrder: p.data.sortOrder ?? 0,
    sizes,
    lengths: list(form.get("lengths")),
    active: form.get("active") === "on",
  };
  try {
    if (p.data.id) await db.product.update({ where: { id: p.data.id }, data });
    else await db.product.create({ data });
  } catch {
    return { error: "SKU นี้มีอยู่แล้ว" };
  }
  revalidatePath("/admin/products");
  return { ok: "บันทึกสินค้าแล้ว" };
}

// ---------- orders ----------

export async function updateOrderStatus(form: FormData) {
  await requireAdmin();
  const status = String(form.get("status")) as OrderStatus;
  if (!(status in STATUS_LABEL)) return;
  const ids = form.getAll("orderId").map(String);
  const roundId = String(form.get("roundId") ?? "");
  const applyAll = form.get("applyAll") === "on" && roundId;
  if (!ids.length && !applyAll) return;
  const where = applyAll ? { roundId, status: { not: "CANCELLED" as const } } : { id: { in: ids } };
  const orders = await db.order.findMany({ where, select: { id: true, employeeId: true, orderNumber: true, status: true } });
  const changed = orders.filter((o) => o.status !== status);
  if (changed.length === 0) return;
  await db.$transaction([
    db.order.updateMany({ where: { id: { in: changed.map((o) => o.id) } }, data: { status } }),
    db.orderEvent.createMany({ data: changed.map((o) => ({ orderId: o.id, status, message: STATUS_LABEL[status] })) }),
  ]);
  for (const o of changed) {
    await notifyEmployee(o.employeeId, {
      kind: "STATUS",
      title: STATUS_LABEL[status],
      body: `คำสั่งซื้อ ${o.orderNumber}: ${STATUS_LABEL[status]}`,
      href: `/orders/${o.id}`,
    });
  }
  revalidatePath("/admin/orders");
}

export async function markRefunded(form: FormData) {
  await requireAdmin();
  const order = await db.order.findUnique({ where: { id: String(form.get("id")) } });
  if (!order || order.paymentStatus !== "REFUND_DUE") return;
  await db.order.update({
    where: { id: order.id },
    data: { amountPaid: order.total, paymentStatus: order.total > 0 ? "PAID" : "NOT_REQUIRED" },
  });
  await db.orderEvent.create({ data: { orderId: order.id, message: "คืนเงินส่วนต่างแล้ว" } });
  revalidatePath("/admin/orders");
}

// ---------- team ----------

export async function addAdmin(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  if (me.role !== "OWNER") return { error: "เฉพาะเจ้าของระบบ (Owner) เท่านั้นที่เพิ่มผู้ดูแลได้" };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !name || password.length < 8) return { error: "กรอกชื่อ อีเมล และรหัสผ่านอย่างน้อย 8 ตัว" };
  if (await db.adminUser.findUnique({ where: { email } })) return { error: "อีเมลนี้เป็นผู้ดูแลอยู่แล้ว" };
  await db.adminUser.create({
    data: { email, name, passwordHash: await bcrypt.hash(password, 10), role: form.get("role") === "OWNER" ? "OWNER" : "ADMIN" },
  });
  revalidatePath("/admin/team");
  return { ok: "เพิ่มผู้ดูแลแล้ว" };
}

export async function removeAdmin(form: FormData) {
  const me = await requireAdmin();
  const id = String(form.get("id"));
  if (me.role !== "OWNER" || id === me.id) return;
  await db.adminUser.delete({ where: { id } });
  revalidatePath("/admin/team");
}
