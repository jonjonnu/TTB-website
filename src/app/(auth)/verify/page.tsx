import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { maskEmail, maskPhone } from "@/lib/format";
import { OTP_RESEND_SECONDS, OTP_TTL_MINUTES, showTestOtp } from "@/lib/otp";
import { Stepper, TopBar } from "@/components/ui";
import { VerifyForm } from "./verify-form";

export const dynamic = "force-dynamic";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ otp?: string }> }) {
  const { otp: otpId } = await searchParams;
  if (!otpId) notFound();
  const otp = await db.otpCode.findUnique({ where: { id: otpId }, include: { employee: true } });
  if (!otp) notFound();
  const emp = otp.employee;
  const to = otp.channel === "SMS" ? emp.phone : emp.email;

  // Test mode: show the code that the mock provider "sent", so testers don't need a real phone.
  let testCode: string | null = null;
  if (showTestOtp() && to) {
    const msg = await db.outboundMessage.findFirst({ where: { to, createdAt: { gte: otp.createdAt } }, orderBy: { createdAt: "desc" } });
    testCode = msg?.body.match(/\b(\d{6})\b/)?.[1] ?? null;
  }

  const resendIn = Math.max(0, OTP_RESEND_SECONDS - Math.floor((Date.now() - otp.createdAt.getTime()) / 1000));

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <TopBar title="ยืนยันตัวตน" back={otp.purpose === "REGISTER" ? "/register" : "/forgot-password"} />
      <Stepper step={2} total={2} />
      <VerifyForm
        key={otp.id}
        otpId={otp.id}
        purpose={otp.purpose}
        channel={otp.channel}
        destination={otp.channel === "SMS" ? maskPhone(emp.phone) : maskEmail(emp.email)}
        canSwitch={otp.channel === "SMS" ? !!emp.email : !!emp.phone}
        ttlMinutes={OTP_TTL_MINUTES}
        resendIn={resendIn}
        testCode={testCode}
      />
    </div>
  );
}
