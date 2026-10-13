import { Stepper, TopBar } from "@/components/ui";
import { registerStart } from "../actions";
import { OtpStartForm } from "./otp-start-form";

export default function RegisterPage() {
  return (
    <div className="min-h-dvh bg-white">
      <TopBar title="สร้างบัญชี" back="/login" />
      <Stepper step={1} total={2} />
      <div className="px-4 py-5">
        <h2 className="text-xl font-medium">ลงทะเบียนพนักงาน</h2>
        <p className="mt-1 mb-5 text-sm text-muted">
          ระบบจะส่งรหัส OTP 6 หลักไปยังเบอร์มือถือหรืออีเมลที่ลงทะเบียนไว้กับฝ่ายบุคคล เพื่อยืนยันว่าเป็นคุณ
        </p>
        <OtpStartForm action={registerStart} mode="register" />
      </div>
    </div>
  );
}
