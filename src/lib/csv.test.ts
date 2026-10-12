import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvObjects, toCsv } from "./csv";

describe("csv", () => {
  it("round-trips quotes, commas and Thai text", () => {
    const rows = [["รหัส", "ชื่อ"], ["1100231", 'ณัฐธิดา "นัท", ศรีสุข']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it("maps headers to objects", () => {
    expect(parseCsvObjects("Employee_Code,Gender\r\n1100231,F\r\n")).toEqual([{ employee_code: "1100231", gender: "F" }]);
  });
});
