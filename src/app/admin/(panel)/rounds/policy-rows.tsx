"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui";

type Row = { department: string; mode: "FIXED" | "CREDIT"; credit: number; people: number };

export function PolicyRows({ rows }: { rows: Row[] }) {
  const [modes, setModes] = useState(Object.fromEntries(rows.map((r) => [r.department, r.mode])));
  return (
    <table className="mt-3 w-full text-sm">
      <thead className="bg-cream text-left text-xs text-muted">
        <tr>
          <th className="px-3 py-2 font-normal">แผนก</th>
          <th className="px-3 py-2 font-normal">รูปแบบ</th>
          <th className="px-3 py-2 font-normal">เครดิตต่อคน</th>
          <th className="px-3 py-2 font-normal">ส่วนเกิน</th>
          <th className="px-3 py-2 text-right font-normal">คน</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.department} className="border-t border-line">
            <td className="px-3 py-2">{r.department}</td>
            <td className="px-3 py-2">
              <Select
                name={`mode_${r.department}`}
                value={modes[r.department]}
                onChange={(e) => setModes({ ...modes, [r.department]: e.target.value as Row["mode"] })}
                className="h-9"
              >
                <option value="FIXED">ตามสิทธิ์ (Fix Item)</option>
                <option value="CREDIT">เครดิต</option>
              </Select>
            </td>
            <td className="px-3 py-2">
              <Input
                type="number"
                name={`credit_${r.department}`}
                defaultValue={r.credit || 2000}
                min={0}
                disabled={modes[r.department] !== "CREDIT"}
                className="h-9"
              />
            </td>
            <td className="px-3 py-2 text-muted">{modes[r.department] === "CREDIT" ? "พนักงานชำระส่วนเกิน" : "ซื้อเพิ่มชำระเอง"}</td>
            <td className="px-3 py-2 text-right">{r.people.toLocaleString("th-TH")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
