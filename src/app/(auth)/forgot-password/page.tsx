import { Stepper, TopBar } from "@/components/ui";
import { resetStart } from "../actions";
import { OtpStartForm } from "../register/otp-start-form";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-dvh bg-white">
      <TopBar title="ลืมรหัสผ่าน" back="/login" />
      <Stepper step={1} total={2} />
      <div className="px-4 py-5">
        <h2 className="text-xl font-bold">ตั้งรหัสผ่านใหม่</h2>
        <p className="mt-1 mb-5 text-sm text-muted">กรอกรหัสพนักงานและรหัสผ่านใหม่ ระบบจะส่งรหัส OTP เพื่อยืนยันตัวตน</p>
        <OtpStartForm action={resetStart} mode="reset" />
      </div>
    </div>
  );
}
