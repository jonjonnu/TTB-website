import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { messaging } from "@/lib/providers/messaging";
import type { OtpChannel, OtpPurpose } from "@prisma/client";

export const OTP_TTL_MINUTES = 5;
export const OTP_RESEND_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;

export function showTestOtp() {
  return process.env.SHOW_TEST_OTP === "true";
}

/** Creates a 6-digit code, sends it, and returns it (only so test mode can show it). */
export async function issueOtp(opts: {
  employeeId: string;
  purpose: OtpPurpose;
  channel: OtpChannel;
  to: string;
  pendingPasswordHash?: string;
}) {
  const recent = await db.otpCode.findFirst({
    where: { employeeId: opts.employeeId, purpose: opts.purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < OTP_RESEND_SECONDS * 1000) {
    return { ok: false as const, error: "เพิ่งส่งรหัสไปแล้ว กรุณารอสักครู่ก่อนขอรหัสใหม่", otpId: recent.id };
  }
  // Only the newest code is valid.
  await db.otpCode.updateMany({
    where: { employeeId: opts.employeeId, purpose: opts.purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const otp = await db.otpCode.create({
    data: {
      employeeId: opts.employeeId,
      purpose: opts.purpose,
      channel: opts.channel,
      codeHash: await bcrypt.hash(code, 8),
      pendingPasswordHash: opts.pendingPasswordHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    },
  });
  await messaging().send({
    channel: opts.channel,
    to: opts.to,
    subject: "รหัสยืนยัน TTB Uniform",
    body: `รหัส OTP ของคุณคือ ${code} (ใช้ได้ ${OTP_TTL_MINUTES} นาที) อย่าบอกรหัสนี้กับผู้อื่น`,
  });
  return { ok: true as const, otpId: otp.id, code };
}

export async function verifyOtp(otpId: string, code: string) {
  const otp = await db.otpCode.findUnique({ where: { id: otpId } });
  if (!otp || otp.consumedAt) return { ok: false as const, error: "รหัสนี้ใช้ไม่ได้แล้ว กรุณาขอรหัสใหม่" };
  if (otp.expiresAt < new Date()) return { ok: false as const, error: "รหัสหมดอายุ กรุณาขอรหัสใหม่" };
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return { ok: false as const, error: "กรอกผิดหลายครั้งเกินไป กรุณาขอรหัสใหม่" };
  const match = await bcrypt.compare(code, otp.codeHash);
  if (!match) {
    await db.otpCode.update({ where: { id: otpId }, data: { attempts: { increment: 1 } } });
    return { ok: false as const, error: "รหัสไม่ถูกต้อง" };
  }
  await db.otpCode.update({ where: { id: otpId }, data: { consumedAt: new Date() } });
  return { ok: true as const, otp };
}
