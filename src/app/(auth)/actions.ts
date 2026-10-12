"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { maskEmail, maskPhone } from "@/lib/format";
import { issueOtp, verifyOtp } from "@/lib/otp";
import { endEmployeeSession, startEmployeeSession } from "@/lib/session";
import { notifyEmployee } from "@/lib/notify";
import type { ActionState } from "@/components/forms";

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  const code = String(form.get("employeeCode") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const emp = await db.employee.findUnique({ where: { employeeCode: code } });
  if (!emp || !emp.active || !emp.passwordHash || !(await bcrypt.compare(password, emp.passwordHash))) {
    return { error: "รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง" };
  }
  await startEmployeeSession(emp.id);
  redirect("/");
}

export async function logout() {
  await endEmployeeSession();
  redirect("/login");
}

export type LookupResult =
  | { found: false; error: string }
  | {
      found: true;
      name: string;
      detail: string;
      phone: string | null;
      email: string | null;
      registered: boolean;
    };

/** Shows who the employee code belongs to, so the person can confirm before an OTP is sent. */
export async function lookupEmployee(code: string): Promise<LookupResult> {
  const emp = await db.employee.findUnique({ where: { employeeCode: code.trim() } });
  if (!emp || !emp.active) return { found: false, error: "ไม่พบรหัสพนักงานนี้ กรุณาติดต่อฝ่ายบุคคล" };
  return {
    found: true,
    name: `${emp.firstName} ${emp.lastName}`,
    detail: [emp.department, emp.subDepartment, emp.position].filter(Boolean).join(" · "),
    phone: emp.phone ? maskPhone(emp.phone) : null,
    email: emp.email ? maskEmail(emp.email) : null,
    registered: !!emp.registeredAt,
  };
}

const passwordSchema = z
  .object({ password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" });

async function startOtpFlow(form: FormData, purpose: "REGISTER" | "RESET_PASSWORD"): Promise<ActionState> {
  const code = String(form.get("employeeCode") ?? "").trim();
  const channel = form.get("channel") === "EMAIL" ? "EMAIL" : "SMS";
  const parsed = passwordSchema.safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const emp = await db.employee.findUnique({ where: { employeeCode: code } });
  if (!emp || !emp.active) return { error: "ไม่พบรหัสพนักงานนี้ กรุณาติดต่อฝ่ายบุคคล" };
  if (purpose === "REGISTER" && emp.registeredAt) return { error: "รหัสพนักงานนี้ลงทะเบียนแล้ว กรุณาเข้าสู่ระบบ หรือใช้ลืมรหัสผ่าน" };
  if (purpose === "RESET_PASSWORD" && !emp.registeredAt) return { error: "รหัสพนักงานนี้ยังไม่ได้ลงทะเบียน" };
  const to = channel === "SMS" ? emp.phone : emp.email;
  if (!to) return { error: channel === "SMS" ? "ไม่มีเบอร์โทรในระบบ กรุณาเลือกอีเมล" : "ไม่มีอีเมลในระบบ กรุณาเลือก SMS" };

  const res = await issueOtp({
    employeeId: emp.id,
    purpose,
    channel,
    to,
    pendingPasswordHash: await bcrypt.hash(parsed.data.password, 10),
  });
  if (!res.ok) return { error: res.error };
  redirect(`/verify?otp=${res.otpId}`);
}

export async function registerStart(_: ActionState, form: FormData) {
  return startOtpFlow(form, "REGISTER");
}

export async function resetStart(_: ActionState, form: FormData) {
  return startOtpFlow(form, "RESET_PASSWORD");
}

export async function verifyCode(_: ActionState, form: FormData): Promise<ActionState> {
  const otpId = String(form.get("otpId"));
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { error: "กรุณากรอกรหัส 6 หลัก" };
  const res = await verifyOtp(otpId, code);
  if (!res.ok) return { error: res.error };
  const { otp } = res;
  const emp = await db.employee.update({
    where: { id: otp.employeeId },
    data: {
      passwordHash: otp.pendingPasswordHash ?? undefined,
      registeredAt: otp.purpose === "REGISTER" ? new Date() : undefined,
    },
  });
  await notifyEmployee(emp.id, {
    kind: "ACCOUNT",
    title: otp.purpose === "REGISTER" ? "สร้างบัญชีสำเร็จ" : "เปลี่ยนรหัสผ่านแล้ว",
    body:
      otp.purpose === "REGISTER"
        ? "ยินดีต้อนรับสู่ระบบสั่งเครื่องแบบพนักงาน TTB"
        : "รหัสผ่านของคุณถูกเปลี่ยนแล้ว หากไม่ได้ทำรายการนี้ กรุณาติดต่อฝ่ายบุคคล",
  });
  await startEmployeeSession(emp.id);
  redirect("/");
}

export async function resendCode(otpId: string, channel: "SMS" | "EMAIL"): Promise<{ otpId?: string; error?: string }> {
  const old = await db.otpCode.findUnique({ where: { id: otpId }, include: { employee: true } });
  if (!old) return { error: "ไม่พบคำขอ กรุณาเริ่มใหม่" };
  const to = channel === "SMS" ? old.employee.phone : old.employee.email;
  if (!to) return { error: channel === "SMS" ? "ไม่มีเบอร์โทรในระบบ" : "ไม่มีอีเมลในระบบ" };
  const res = await issueOtp({
    employeeId: old.employeeId,
    purpose: old.purpose,
    channel,
    to,
    pendingPasswordHash: old.pendingPasswordHash ?? undefined,
  });
  return res.ok ? { otpId: res.otpId } : { error: res.error };
}
