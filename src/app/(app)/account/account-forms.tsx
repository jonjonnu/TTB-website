"use client";

import { useActionState } from "react";
import { Input, Textarea } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/forms";
import { changePassword, saveAddress } from "../actions";

export function AddressForm({ initial }: { initial: string }) {
  const [state, action] = useActionState(saveAddress, undefined);
  return (
    <form action={action} className="mt-2 space-y-2">
      <Textarea name="homeAddress" defaultValue={initial} placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์" />
      <FormMessage state={state} />
      <SubmitButton variant="secondary" className="h-9">
        บันทึกที่อยู่
      </SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="mt-2 space-y-2">
      <Input name="current" type="password" placeholder="รหัสผ่านปัจจุบัน" required autoComplete="current-password" />
      <Input name="password" type="password" placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)" required minLength={8} autoComplete="new-password" />
      <Input name="confirm" type="password" placeholder="ยืนยันรหัสผ่านใหม่" required autoComplete="new-password" />
      <FormMessage state={state} />
      <SubmitButton variant="secondary" className="h-9">
        เปลี่ยนรหัสผ่าน
      </SubmitButton>
    </form>
  );
}
