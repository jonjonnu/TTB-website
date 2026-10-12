"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Input, Select, cx } from "@/components/ui";
import { FormMessage, SubmitButton, useFormAction } from "@/components/forms";
import { STATUS_LABEL } from "@/lib/portal-labels";
import { employeeBulkAction } from "../../actions";

type Row = {
  id: string;
  code: string;
  name: string;
  department: string;
  subDepartment: string | null;
  workLocation: string | null;
  years: number | null;
  registered: boolean;
  orderId: string | null;
  status: string | null;
  tracking: string | null;
};

const statusTone = (s: string) => (s === "DELIVERED" ? "ok" : s === "SHIPPING" ? "navy" : s === "PLACED" ? "gray" : "accent") as "ok" | "navy" | "gray" | "accent";

export function EmployeeTable({ rows, roundId, defaultClose }: { rows: Row[]; roundId: string; defaultClose: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<"status" | "extend" | "notify" | null>(null);
  const { state, onSubmit, pending } = useFormAction(employeeBulkAction);
  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="roundId" value={roundId} />
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="employeeId" value={id} />
      ))}
      {selected.size > 0 && (
        <div className="mx-3 mb-3 space-y-2 rounded-lg bg-navy px-3 py-2 text-white">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto text-sm">เลือกแล้ว {selected.size} คน</span>
            {(
              [
                ["status", "เปลี่ยนสถานะ"],
                ["extend", "ขยายเวลาให้คนที่เลือก"],
                ["notify", "ส่งแจ้งเตือน"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setPanel(panel === k ? null : k)}
                className={cx("rounded-md border px-3 py-1.5 text-xs", panel === k ? "border-white bg-white text-navy" : "border-white/40")}
              >
                {label}
              </button>
            ))}
            <a href="#import" className="rounded-md border border-white/40 px-3 py-1.5 text-xs">
              ใส่เลขพัสดุ J&T (CSV)
            </a>
          </div>
          {panel && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-white p-2 text-ink">
              {panel === "status" && (
                <Select name="status" defaultValue="PRODUCING" className="h-9 w-auto">
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              )}
              {panel === "extend" && <Input type="datetime-local" name="newClosesAt" defaultValue={defaultClose} className="h-9 w-auto" />}
              {panel === "notify" && <Input name="message" placeholder="ข้อความถึงพนักงานที่เลือก" className="h-9 flex-1" />}
              <SubmitButton name="intent" value={panel} pending={pending} className="h-9">
                ยืนยัน
              </SubmitButton>
            </div>
          )}
          <FormMessage state={state} />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-cream text-left text-xs text-muted">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="เลือกทั้งหมด"
                  checked={all}
                  onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="accent-navy"
                />
              </th>
              {["รหัส", "ชื่อ-นามสกุล", "แผนก / หน่วยงาน", "Work Location", "อายุงาน", "สถานะ", "เลขพัสดุ J&T"].map((h) => (
                <th key={h} className="px-3 py-2 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={cx("border-t border-line", selected.has(r.id) && "bg-cream")}>
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`เลือก ${r.code}`} className="accent-navy" />
                </td>
                <td className="px-3 py-2 font-latin">{r.code}</td>
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 text-muted">
                  {r.department}
                  {r.subDepartment ? ` / ${r.subDepartment}` : ""}
                </td>
                <td className="px-3 py-2">{r.workLocation ?? "-"}</td>
                <td className="px-3 py-2">{r.years === null ? "-" : `${r.years} ปี`}</td>
                <td className="px-3 py-2">
                  {r.orderId && r.status ? (
                    <Link href={`/admin/orders/${r.orderId}`}>
                      <Badge tone={statusTone(r.status)}>{STATUS_LABEL[r.status]}</Badge>
                    </Link>
                  ) : r.registered ? (
                    <Badge tone="accent">ยังไม่สั่ง</Badge>
                  ) : (
                    <Badge tone="gray">ยังไม่ลงทะเบียน</Badge>
                  )}
                </td>
                <td className="px-3 py-2 font-latin text-muted">{r.tracking ?? "–"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted">
                  ไม่พบพนักงาน
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </form>
  );
}
