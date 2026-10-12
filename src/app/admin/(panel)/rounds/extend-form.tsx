"use client";

import { useState } from "react";
import { Input, Label, Select } from "@/components/ui";
import { FormMessage, SubmitButton, useFormAction } from "@/components/forms";
import { fromLocalInput, thDate, thDateTime, thShortDate, toLocalInput } from "@/lib/format";
import { DAY } from "@/lib/rounds";
import { extendRound } from "../../actions";

export function ExtendForm(props: {
  roundId: string;
  currentClose: string;
  originalClose: string;
  opensAt: string;
  deliveryDays: number;
  departments: string[];
}) {
  const { state, onSubmit, pending: submitting } = useFormAction(extendRound);
  const current = new Date(props.currentClose);
  const [value, setValue] = useState(toLocalInput(new Date(current.getTime() + 4 * DAY)));
  const newClose = value ? fromLocalInput(value) : current;
  const valid = !Number.isNaN(newClose.getTime());
  const due = new Date(newClose.getTime() + props.deliveryDays * DAY);
  const oldDue = new Date(current.getTime() + props.deliveryDays * DAY);

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3">
      <input type="hidden" name="id" value={props.roundId} />
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label>ปิดรับเดิม</Label>
          <Input value={thDateTime(current)} disabled readOnly />
        </div>
        <div>
          <Label>ปิดรับใหม่</Label>
          <Input type="datetime-local" name="newClosesAt" value={value} onChange={(e) => setValue(e.target.value)} required />
        </div>
        <div>
          <Label>ใช้กับ</Label>
          <Select name="scope" defaultValue="ALL">
            <option value="ALL">พนักงานทุกคน</option>
            {props.departments.map((d) => (
              <option key={d} value={d}>
                เฉพาะแผนก {d}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label>เหตุผล (แสดงในการแจ้งเตือนพนักงาน)</Label>
        <Input name="reason" defaultValue="ขยายเวลาตามคำขอฝ่ายบุคคล" required />
      </div>
      {valid && (
        <div className="grid gap-2 rounded-lg bg-gray-50 p-3 text-sm md:grid-cols-3">
          <div>
            <p className="text-xs text-muted">เปิดรับ</p>
            <p className="font-semibold">
              {thShortDate(new Date(props.opensAt))} – {thDate(newClose)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">ปิดตรวจสอบ</p>
            <p className="font-semibold">เริ่ม {thDate(new Date(newClose.getTime() + 60_000))}</p>
          </div>
          <div>
            <p className="text-xs text-muted">ส่งถึงสาขา ({props.deliveryDays} วัน)</p>
            <p className="font-semibold">
              ภายใน {thDate(due)} <span className="text-xs font-normal text-accent">(เดิม {thShortDate(oldDue)})</span>
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="notify" defaultChecked className="h-4 w-4 accent-navy" />
          แจ้งพนักงานทางอีเมล / SMS ทันที
        </label>
        <div className="flex items-center gap-3">
          <FormMessage state={state} />
          <SubmitButton pending={submitting}>ยืนยันขยายเวลา</SubmitButton>
        </div>
      </div>
    </form>
  );
}
