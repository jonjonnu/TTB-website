"use client";

import { useState, useTransition } from "react";
import { Input, Label, cx } from "@/components/ui";
import { FormMessage, SubmitButton, useFormAction, type ActionState } from "@/components/forms";
import { lookupEmployee, type LookupResult } from "../actions";

/** Shared by sign-up and forgot-password: employee code -> confirm identity -> channel -> new password. */
export function OtpStartForm({
  action,
  mode,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  mode: "register" | "reset";
}) {
  const { state, onSubmit, pending: submitting } = useFormAction(action);
  const [who, setWho] = useState<LookupResult | null>(null);
  const [channel, setChannel] = useState<"SMS" | "EMAIL">("SMS");
  const [pending, start] = useTransition();

  function lookup(code: string) {
    if (code.trim().length < 3) return setWho(null);
    start(async () => {
      const res = await lookupEmployee(code);
      setWho(res);
      if (res.found && !res.phone && res.email) setChannel("EMAIL");
    });
  }

  const found = who?.found ? who : null;
  const blocked = found && (mode === "register" ? found.registered : !found.registered);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="employeeCode">รหัสพนักงาน</Label>
        <Input
          id="employeeCode"
          name="employeeCode"
          inputMode="numeric"
          placeholder="เช่น 1100231"
          required
          onBlur={(e) => lookup(e.target.value)}
          onChange={(e) => e.target.value.length >= 7 && lookup(e.target.value)}
        />
        {pending && <p className="mt-1 text-xs text-muted">กำลังค้นหา…</p>}
        {who && !who.found && <p className="mt-1 text-xs text-bad">{who.error}</p>}
      </div>

      {found && (
        <div className="rounded-lg bg-cream px-3 py-2.5 text-sm">
          <p className="text-xs text-muted">พบข้อมูลพนักงาน</p>
          <p className="font-medium">{found.name}</p>
          <p className="text-xs text-muted">{found.detail}</p>
          {blocked && (
            <p className="mt-1 text-xs text-bad">
              {mode === "register" ? "รหัสนี้ลงทะเบียนแล้ว กรุณาเข้าสู่ระบบ" : "รหัสนี้ยังไม่ได้ลงทะเบียน"}
            </p>
          )}
        </div>
      )}

      <div>
        <Label>ส่งรหัส OTP ไปที่</Label>
        <div className="space-y-2">
          {(
            [
              ["SMS", "SMS", found?.phone ?? "เบอร์โทรที่ลงทะเบียนกับฝ่ายบุคคล"],
              ["EMAIL", "อีเมล", found?.email ?? "อีเมลที่ลงทะเบียนกับฝ่ายบุคคล"],
            ] as const
          ).map(([value, label, hint]) => {
            const disabled = !!found && !(value === "SMS" ? found.phone : found.email);
            return (
              <label
                key={value}
                className={cx(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5",
                  channel === value ? "border-navy bg-navy-50" : "border-line bg-white",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <input
                  type="radio"
                  name="channel"
                  value={value}
                  checked={channel === value}
                  disabled={disabled}
                  onChange={() => setChannel(value)}
                  className="accent-navy"
                />
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <Label htmlFor="password">{mode === "register" ? "ตั้งรหัสผ่าน" : "รหัสผ่านใหม่"}</Label>
        <Input id="password" name="password" type="password" placeholder="อย่างน้อย 8 ตัวอักษร" required minLength={8} autoComplete="new-password" />
      </div>
      <div>
        <Label htmlFor="confirm">ยืนยันรหัสผ่าน</Label>
        <Input id="confirm" name="confirm" type="password" placeholder="พิมพ์รหัสผ่านอีกครั้ง" required autoComplete="new-password" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={submitting} className="w-full" disabled={!!blocked}>
        ส่งรหัส OTP
      </SubmitButton>
      <p className="text-center text-xs text-muted">เบอร์หรืออีเมลไม่ถูกต้อง? ติดต่อฝ่ายบุคคลเพื่อแก้ไขข้อมูล</p>
    </form>
  );
}
