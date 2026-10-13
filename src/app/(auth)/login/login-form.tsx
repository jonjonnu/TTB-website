"use client";

import Link from "next/link";
import { Input, Label } from "@/components/ui";
import { FormMessage, SubmitButton, useFormAction } from "@/components/forms";
import { login } from "../actions";

export function LoginForm() {
  const { state, onSubmit, pending: submitting } = useFormAction(login);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="employeeCode">รหัสพนักงาน</Label>
        <Input id="employeeCode" name="employeeCode" inputMode="numeric" placeholder="เช่น 1234567" required autoComplete="username" />
      </div>
      <div>
        <Label
          htmlFor="password"
          extra={
            <Link href="/forgot-password" className="text-xs font-medium text-navy">
              ลืมรหัสผ่าน?
            </Link>
          }
        >
          รหัสผ่าน
        </Label>
        <Input id="password" name="password" type="password" placeholder="รหัสผ่านของคุณ" required autoComplete="current-password" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={submitting} className="w-full">เข้าสู่ระบบ</SubmitButton>
    </form>
  );
}
