"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseCsvObjects } from "@/lib/csv";
import { fromLocalInput, thDate, thDateTime } from "@/lib/format";
import { notifyEmployee, notifyMany } from "@/lib/notify";
import { DEPARTMENTS, STATUS_LABEL, EXCHANGE_STATUS_LABEL } from "@/lib/portal-labels";
import { DEFAULT_CARRIER } from "@/lib/providers/tracking";
import { DAY } from "@/lib/rounds";
import { endAdminSession, requireAdmin, startAdminSession } from "@/lib/session";
import { getSettings, saveSettings } from "@/lib/settings";
import type { ActionState } from "@/components/forms";
import type { BenefitMode, OrderStatus, PackingMode } from "@prisma/client";

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

/**
 * CSV columns: employee_code, first_name, last_name, gender, department, sub_department, position,
 * manager, start_date (YYYY-MM-DD), work_location, work_address, email, phone
 */
export async function importEmployees(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "กรุณาเลือกไฟล์ CSV" };
  const rows = parseCsvObjects(await file.text());
  if (rows.length === 0) return { error: "ไม่พบข้อมูลในไฟล์" };
  const errors: string[] = [];
  let created = 0;
  let updated = 0;
  for (const [i, r] of rows.entries()) {
    const line = i + 2;
    const gender = GENDER[(r.gender ?? "").toLowerCase()];
    if (!r.employee_code || !r.first_name || !r.last_name || !gender || !r.department || !r.position) {
      errors.push(`แถว ${line}: ข้อมูลไม่ครบ`);
      continue;
    }
    const start = r.start_date ? new Date(`${r.start_date}T00:00:00+07:00`) : null;
    if (start && Number.isNaN(start.getTime())) {
      errors.push(`แถว ${line}: start_date ต้องเป็น YYYY-MM-DD`);
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
      startDate: start,
      workLocation: r.work_location || null,
      workAddress: r.work_address || null,
      email: r.email || null,
      phone: r.phone || null,
      active: true,
    };
    const res = await db.employee.upsert({
      where: { employeeCode: r.employee_code },
      create: { employeeCode: r.employee_code, ...data },
      update: data,
    });
    if (res.createdAt.getTime() === res.updatedAt.getTime()) created++;
    else updated++;
  }
  revalidatePath("/admin/employees");
  const summary = `นำเข้าแล้ว: เพิ่มใหม่ ${created} คน อัปเดต ${updated} คน`;
  return errors.length ? { error: `${summary} · มีข้อผิดพลาด ${errors.length} แถว: ${errors.slice(0, 5).join(" / ")}` } : { ok: summary };
}

/** Bulk actions on the employees page for the selected people. */
export async function employeeBulkAction(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const ids = form.getAll("employeeId").map(String);
  const intent = String(form.get("intent"));
  const roundId = String(form.get("roundId") ?? "");
  if (ids.length === 0) return { error: "ยังไม่ได้เลือกพนักงาน" };

  if (intent === "status") {
    const status = String(form.get("status")) as OrderStatus;
    if (!(status in STATUS_LABEL)) return { error: "เลือกสถานะ" };
    const orders = await db.order.findMany({ where: { roundId, employeeId: { in: ids } }, select: { id: true } });
    const n = await setOrderStatus(
      orders.map((o) => o.id),
      status,
    );
    revalidatePath("/admin/employees");
    return { ok: `อัปเดตสถานะ ${n} คำสั่งซื้อ (คนที่ยังไม่สั่งจะถูกข้าม)` };
  }

  if (intent === "extend") {
    const round = await db.orderRound.findUnique({ where: { id: roundId } });
    if (!round) return { error: "ไม่พบรอบ" };
    const v = String(form.get("newClosesAt") ?? "");
    if (!v) return { error: "เลือกวันปิดรับใหม่" };
    const newClosesAt = fromLocalInput(v);
    if (newClosesAt <= new Date()) return { error: "วันปิดรับใหม่ต้องเป็นเวลาในอนาคต" };
    await db.roundExtension.create({
      data: {
        roundId,
        scope: "EMPLOYEES",
        employeeIds: ids,
        previousClosesAt: round.closedEarlyAt ?? round.closesAt,
        newClosesAt,
        reason: "ขยายเวลาเฉพาะบุคคล",
        createdBy: admin.name,
      },
    });
    await notifyMany(ids, {
      kind: "EXTENSION",
      title: "ขยายเวลาสั่งซื้อ",
      body: `${round.name} ขยายเวลาปิดรับสำหรับคุณเป็น ${thDateTime(newClosesAt)} น.`,
      href: "/",
    });
    revalidatePath("/admin/employees");
    return { ok: `ขยายเวลาให้ ${ids.length} คนแล้ว` };
  }

  if (intent === "notify") {
    const message = String(form.get("message") ?? "").trim();
    if (!message) return { error: "พิมพ์ข้อความที่จะส่ง" };
    await notifyMany(ids, { kind: "REMINDER", title: "แจ้งเตือนจาก TTB Uniform", body: message.slice(0, 300), href: "/" });
    return { ok: `ส่งแจ้งเตือนถึง ${ids.length} คนแล้ว` };
  }
  return { error: "ไม่รู้จักคำสั่ง" };
}

/** CSV columns: order_number (or employee_code + current round), tracking_number, carrier (optional) */
export async function importTracking(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const file = form.get("file");
  const roundId = String(form.get("roundId") ?? "");
  if (!(file instanceof File) || file.size === 0) return { error: "กรุณาเลือกไฟล์ CSV เลขพัสดุ" };
  const rows = parseCsvObjects(await file.text());
  let done = 0;
  const missing: string[] = [];
  for (const r of rows) {
    if (!r.tracking_number) continue;
    const order = r.order_number
      ? await db.order.findUnique({ where: { orderNumber: r.order_number } })
      : r.employee_code && roundId
        ? await db.order.findFirst({ where: { roundId, employee: { employeeCode: r.employee_code } } })
        : null;
    if (!order) {
      missing.push(r.order_number || r.employee_code || "?");
      continue;
    }
    await setTracking(order.id, r.tracking_number, r.carrier || DEFAULT_CARRIER);
    done++;
  }
  revalidatePath("/admin/employees");
  revalidatePath("/admin/orders");
  const msg = `ใส่เลขพัสดุแล้ว ${done} คำสั่งซื้อ`;
  return missing.length ? { error: `${msg} · ไม่พบ ${missing.length} รายการ: ${missing.slice(0, 8).join(", ")}` } : { ok: msg };
}

async function setTracking(orderId: string, trackingNumber: string, carrier: string) {
  const order = await db.order.update({ where: { id: orderId }, data: { trackingNumber, carrier } });
  if (order.status !== "SHIPPING" && order.status !== "DELIVERED" && order.status !== "CANCELLED") {
    await setOrderStatus([orderId], "SHIPPING");
  }
}

export async function saveTracking(form: FormData) {
  await requireAdmin();
  const tn = String(form.get("trackingNumber") ?? "").trim();
  if (tn) await setTracking(String(form.get("id")), tn, String(form.get("carrier") || DEFAULT_CARRIER));
  revalidatePath("/admin/orders");
}

// ---------- rounds ----------

function policiesFrom(form: FormData) {
  return DEPARTMENTS.map((department) => ({
    department,
    mode: (form.get(`mode_${department}`) === "CREDIT" ? "CREDIT" : "FIXED") as BenefitMode,
    creditAmount: Math.max(0, Number(form.get(`credit_${department}`) ?? 0) || 0),
  }));
}

export async function createRound(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const p = z
    .object({
      name: z.string().min(1, "ตั้งชื่อรอบ"),
      opensAt: z.string().min(1, "เลือกวันเปิดรับ"),
      openDays: z.coerce.number().int().min(1).max(60),
      deliveryDays: z.coerce.number().int().min(1).max(180),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const opensAt = fromLocalInput(p.data.opensAt);
  const closesAt = closeAfter(opensAt, p.data.openDays);
  const settings = await getSettings();
  const round = await db.orderRound.create({
    data: {
      type: "BIG_LOT",
      name: p.data.name,
      year: Number(p.data.opensAt.slice(0, 4)),
      opensAt,
      closesAt,
      originalClosesAt: closesAt,
      deliveryDays: p.data.deliveryDays,
      packing: (String(form.get("packing") || "PER_PERSON") as PackingMode),
      policies: {
        create: DEPARTMENTS.map((department) => ({
          department,
          mode: department === "Back Office" ? "CREDIT" : "FIXED",
          creditAmount: department === "Back Office" ? settings.backOfficeCredit : 0,
        })),
      },
    },
  });
  if (form.get("notify") === "on") await announceOpen(round.id);
  revalidatePath("/admin/rounds");
  return { ok: `สร้าง ${round.name} แล้ว` };
}

/** Close at 23:59 Bangkok time on the last open day. */
function closeAfter(opensAt: Date, openDays: number) {
  const lastDay = new Date(opensAt.getTime() + 7 * 3600_000 + (openDays - 1) * DAY);
  return fromLocalInput(`${lastDay.toISOString().slice(0, 10)}T23:59`);
}

async function announceOpen(roundId: string) {
  const round = await db.orderRound.findUnique({ where: { id: roundId }, include: { members: true, policies: true } });
  if (!round) return;
  const ids =
    round.type === "NEW_JOINERS"
      ? round.members.map((m) => m.employeeId)
      : (await db.employee.findMany({ where: { active: true }, select: { id: true } })).map((e) => e.id);
  await notifyMany(ids, {
    kind: "ROUND_OPEN",
    title: "เปิดให้สั่งจองแล้ว",
    body: `${round.name} เปิดรับ ${thDate(round.opensAt)} – ${thDate(round.closesAt)} เข้าระบบเพื่อเลือกไซส์ของคุณ`,
    href: "/",
  });
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
      // Before the round opens, moving the close date isn't an "extension".
      originalClosesAt: round.opensAt > new Date() ? closesAt : undefined,
      allowEdits: form.get("allowEdits") === "on",
      deliveryDays: Number(form.get("deliveryDays") ?? round.deliveryDays),
      packing: (String(form.get("packing") || round.packing) as PackingMode),
    },
  });
  revalidatePath("/admin/rounds");
  return { ok: "บันทึกแล้ว" };
}

export async function saveRoundPolicies(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(form.get("id"));
  const policies = policiesFrom(form);
  await db.$transaction([
    db.orderRound.update({ where: { id }, data: { creditEnabled: form.get("creditEnabled") === "on" } }),
    ...policies.map((p) =>
      db.roundPolicy.upsert({
        where: { roundId_department: { roundId: id, department: p.department } },
        create: { roundId: id, ...p },
        update: { mode: p.mode, creditAmount: p.creditAmount },
      }),
    ),
  ]);
  revalidatePath("/admin/rounds");
  return { ok: "บันทึกสิทธิ์และเครดิตแล้ว" };
}

export async function extendRound(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(form.get("id"));
  const round = await db.orderRound.findUnique({ where: { id }, include: { members: true } });
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

  const memberIds = round.type === "NEW_JOINERS" ? round.members.map((m) => m.employeeId) : undefined;
  const targets = await db.employee.findMany({
    where: { active: true, ...(department ? { department } : {}), ...(memberIds ? { id: { in: memberIds } } : {}) },
    select: { id: true },
  });
  await notifyMany(
    targets.map((t) => t.id),
    {
      kind: "EXTENSION",
      title: "ขยายเวลาสั่งซื้อ",
      body: `${round.name} ขยายเวลาปิดรับเป็น ${thDateTime(newClosesAt)} น. · ${reason}`,
      href: "/",
      sendExternal: form.get("notify") === "on",
    },
  );
  revalidatePath("/admin/rounds");
  return { ok: `ขยายเวลาแล้ว แจ้งพนักงาน ${targets.length} คน` };
}

export async function closeRoundNow(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  const now = new Date();
  await db.orderRound.update({ where: { id }, data: { closedEarlyAt: now } });
  revalidatePath("/admin/rounds");
}

/** Move a closed round's placed orders to "ปิดรอบสั่งซื้อ". */
export async function markRoundClosed(form: FormData) {
  await requireAdmin();
  const orders = await db.order.findMany({ where: { roundId: String(form.get("id")), status: "PLACED" }, select: { id: true } });
  await setOrderStatus(
    orders.map((o) => o.id),
    "ROUND_CLOSED",
    false,
  );
  revalidatePath("/admin/rounds");
}

export async function remindNotOrdered(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  const round = await db.orderRound.findUnique({ where: { id }, include: { members: true } });
  if (!round) return;
  const memberIds = round.type === "NEW_JOINERS" ? round.members.map((m) => m.employeeId) : undefined;
  const targets = await db.employee.findMany({
    where: { active: true, orders: { none: { roundId: id } }, ...(memberIds ? { id: { in: memberIds } } : {}) },
    select: { id: true },
  });
  await notifyMany(
    targets.map((t) => t.id),
    {
      kind: "REMINDER",
      title: "อย่าลืมสั่งเครื่องแบบ",
      body: `${round.name} ปิดรับ ${thDateTime(round.closesAt)} น. เข้าระบบเพื่อเลือกไซส์ของคุณ`,
      href: "/",
    },
  );
  redirect(`/admin/rounds?round=${id}&reminded=${targets.length}`);
}

export async function saveTimelineSettings(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const p = z
    .object({
      openDays: z.coerce.number().int().min(1).max(60),
      deliveryDays: z.coerce.number().int().min(1).max(180),
      homeDeliveryFee: z.coerce.number().int().min(0),
      backOfficeCredit: z.coerce.number().int().min(0),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "ค่าไม่ถูกต้อง" };
  await saveSettings(p.data);
  revalidatePath("/admin/rounds");
  return { ok: "บันทึกแล้ว" };
}

// ---------- New Joiners ----------

export async function openNewJoinersRound(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const codes = String(form.get("codes") ?? "")
    .split(/[\s,]+/)
    .filter(Boolean);
  const byCode = codes.length ? await db.employee.findMany({ where: { employeeCode: { in: codes } }, select: { id: true, employeeCode: true } }) : [];
  const unknown = codes.filter((c) => !byCode.some((e) => e.employeeCode === c));
  if (unknown.length) return { error: `ไม่พบรหัสพนักงาน: ${unknown.join(", ")}` };
  const ids = [...new Set([...form.getAll("employeeId").map(String), ...byCode.map((e) => e.id)])];
  if (ids.length === 0) return { error: "ยังไม่ได้เลือกพนักงาน" };
  const name = String(form.get("name") ?? "").trim();
  const opensAt = fromLocalInput(String(form.get("opensAt")));
  const closesAt = fromLocalInput(String(form.get("closesAt")));
  if (!name) return { error: "ตั้งชื่อรอบ" };
  if (!(closesAt > opensAt)) return { error: "วันปิดรับต้องหลังวันเปิดรับ" };
  const settings = await getSettings();
  // Same benefit rules as the latest Big Lot.
  const bigLot = await db.orderRound.findFirst({ where: { type: "BIG_LOT" }, include: { policies: true }, orderBy: { opensAt: "desc" } });
  const round = await db.orderRound.create({
    data: {
      type: "NEW_JOINERS",
      name,
      year: Number(String(form.get("opensAt")).slice(0, 4)),
      opensAt,
      closesAt,
      originalClosesAt: closesAt,
      deliveryDays: settings.deliveryDays,
      creditEnabled: bigLot?.creditEnabled ?? true,
      packing: "PER_PERSON",
      policies: {
        create: (bigLot?.policies.length
          ? bigLot.policies
          : DEPARTMENTS.map((d) => ({ department: d, mode: d === "Back Office" ? "CREDIT" : "FIXED", creditAmount: d === "Back Office" ? settings.backOfficeCredit : 0 }))
        ).map((p) => ({ department: p.department, mode: p.mode as BenefitMode, creditAmount: p.creditAmount })),
      },
      members: { create: ids.map((employeeId) => ({ employeeId })) },
    },
  });
  if (form.get("notify") === "on") await announceOpen(round.id);
  revalidatePath("/admin/new-joiners");
  return { ok: `เปิด ${round.name} ให้ ${ids.length} คนแล้ว` };
}

// ---------- entitlements & products ----------

export async function addRule(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const quantity = Number(form.get("quantity"));
  if (!form.get("productId") || !Number.isInteger(quantity) || quantity < 1) return { error: "กรุณาเลือกสินค้าและจำนวน" };
  const g = String(form.get("gender") ?? "");
  const minYears = String(form.get("minYears") ?? "");
  await db.entitlementRule.create({
    data: {
      productId: String(form.get("productId")),
      gender: g === "MALE" || g === "FEMALE" ? g : null,
      department: String(form.get("department") ?? "") || null,
      position: String(form.get("position") ?? "") || null,
      minYears: minYears ? Math.max(0, Number(minYears)) : null,
      quantity,
    },
  });
  revalidatePath("/admin/entitlements");
  return { ok: "เพิ่มรายการแล้ว" };
}

export async function updateRuleQuantity(form: FormData) {
  await requireAdmin();
  const quantity = Number(form.get("quantity"));
  const id = String(form.get("id"));
  if (quantity < 1) await db.entitlementRule.delete({ where: { id } });
  else await db.entitlementRule.update({ where: { id }, data: { quantity } });
  revalidatePath("/admin/entitlements");
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
      price: z.coerce.number().int().min(1, "สินค้าทุกชิ้นต้องมีราคา"),
      stock: z.coerce.number().int().min(0).optional(),
      category: z.string().optional(),
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
    stock: p.data.stock ?? 0,
    category: p.data.category || null,
    description: p.data.description || null,
    imageUrl: p.data.imageUrl || null,
    sortOrder: p.data.sortOrder ?? 0,
    sizes,
    lengths: list(form.get("lengths")),
    departments: form.getAll("departments").map(String),
    creditAllowed: form.get("creditAllowed") === "on",
    personalSale: form.get("personalSale") === "on",
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

export async function toggleProductFlag(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  const flag = String(form.get("flag"));
  if (flag !== "creditAllowed" && flag !== "personalSale") return;
  const p = await db.product.findUnique({ where: { id } });
  if (!p) return;
  await db.product.update({ where: { id }, data: { [flag]: !p[flag] } });
  revalidatePath("/admin/products");
}

// ---------- orders ----------

/** Change status, log it, and notify each employee. Returns how many orders changed. */
async function setOrderStatus(orderIds: string[], status: OrderStatus, notify = true) {
  const orders = await db.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, employeeId: true, orderNumber: true, status: true, trackingNumber: true, carrier: true },
  });
  const changed = orders.filter((o) => o.status !== status);
  if (changed.length === 0) return 0;
  await db.$transaction([
    db.order.updateMany({ where: { id: { in: changed.map((o) => o.id) } }, data: { status } }),
    db.orderEvent.createMany({ data: changed.map((o) => ({ orderId: o.id, status, message: STATUS_LABEL[status] })) }),
  ]);
  if (notify) {
    for (const o of changed) {
      await notifyEmployee(o.employeeId, {
        kind: "STATUS",
        title: STATUS_LABEL[status],
        body: `คำสั่งซื้อ ${o.orderNumber}: ${STATUS_LABEL[status]}${
          status === "SHIPPING" && o.trackingNumber ? ` · ติดตามพัสดุ ${o.carrier ?? DEFAULT_CARRIER} ${o.trackingNumber}` : ""
        }`,
        href: `/orders/${o.id}`,
      });
    }
  }
  return changed.length;
}

export async function updateOrderStatus(form: FormData) {
  await requireAdmin();
  const status = String(form.get("status")) as OrderStatus;
  if (!(status in STATUS_LABEL)) return;
  const ids = form.getAll("orderId").map(String);
  const roundId = String(form.get("roundId") ?? "");
  const applyAll = form.get("applyAll") === "on" && roundId;
  if (!ids.length && !applyAll) return;
  const target = applyAll
    ? (await db.order.findMany({ where: { roundId, status: { not: "CANCELLED" } }, select: { id: true } })).map((o) => o.id)
    : ids;
  await setOrderStatus(target, status);
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

export async function updateExchange(form: FormData) {
  await requireAdmin();
  const status = z.enum(["REQUESTED", "APPROVED", "COMPLETED", "REJECTED"]).safeParse(form.get("status"));
  if (!status.success) return;
  const x = await db.exchangeRequest.update({
    where: { id: String(form.get("id")) },
    data: { status: status.data, adminNote: String(form.get("adminNote") ?? "").trim() || null },
    include: { order: true },
  });
  await notifyEmployee(x.employeeId, {
    kind: "EXCHANGE",
    title: "อัปเดตคำขอเปลี่ยนสินค้า",
    body: `${x.order.orderNumber}: ${EXCHANGE_STATUS_LABEL[x.status]}${x.adminNote ? ` · ${x.adminNote}` : ""}`,
    href: `/orders/${x.orderId}`,
  });
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
    data: {
      email,
      name,
      organization: String(form.get("organization") ?? "").trim() || null,
      passwordHash: await bcrypt.hash(password, 10),
      role: form.get("role") === "OWNER" ? "OWNER" : "ADMIN",
    },
  });
  revalidatePath("/admin/team");
  return { ok: "เพิ่มผู้ดูแลแล้ว" };
}

export async function changeAdminRole(form: FormData) {
  const me = await requireAdmin();
  const id = String(form.get("id"));
  if (me.role !== "OWNER" || id === me.id) return;
  await db.adminUser.update({ where: { id }, data: { role: form.get("role") === "OWNER" ? "OWNER" : "ADMIN" } });
  revalidatePath("/admin/team");
}

export async function removeAdmin(form: FormData) {
  const me = await requireAdmin();
  const id = String(form.get("id"));
  if (me.role !== "OWNER" || id === me.id) return;
  await db.adminUser.delete({ where: { id } });
  revalidatePath("/admin/team");
}
