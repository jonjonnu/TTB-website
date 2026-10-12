"use client";

import { Input, Label } from "@/components/ui";
import { FormMessage, SubmitButton, useFormAction } from "@/components/forms";
import { adminLogin } from "../actions";

export function AdminLoginForm() {
  const { state, onSubmit, pending: submitting } = useFormAction(adminLogin);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">อีเมล</Label>
        <Input id="email" name="email" type="email" required autoComplete="username" />
      </div>
      <div>
        <Label htmlFor="password">รหัสผ่าน</Label>
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={submitting} className="w-full">เข้าสู่ระบบผู้ดูแล</SubmitButton>
    </form>
  );
}
