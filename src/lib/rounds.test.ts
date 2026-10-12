import { describe, expect, it } from "vitest";
import { DAY, daysLeft, deliveryDueAt, effectiveCloseAt, roundPhase } from "./rounds";

const opensAt = new Date("2026-10-10T02:00:00Z");
const closesAt = new Date("2026-10-16T16:59:00Z");
const round = { opensAt, closesAt, originalClosesAt: closesAt, deliveryDays: 45, closedEarlyAt: null };

describe("round timeline", () => {
  it("is open between open and close", () => {
    expect(roundPhase(round, closesAt, new Date("2026-10-01T00:00:00Z"))).toBe("UPCOMING");
    expect(roundPhase(round, closesAt, new Date("2026-10-12T00:00:00Z"))).toBe("OPEN");
    expect(roundPhase(round, closesAt, new Date("2026-10-17T00:00:00Z"))).toBe("CLOSED");
  });
  it("applies a department extension only to that department", () => {
    const later = new Date(closesAt.getTime() + 4 * DAY);
    const ext = [{ scope: "DEPARTMENT" as const, department: "สาขา", newClosesAt: later }];
    expect(effectiveCloseAt(round, ext, "สาขา")).toEqual(later);
    expect(effectiveCloseAt(round, ext, "สำนักงานใหญ่")).toEqual(closesAt);
  });
  it("closing early overrides everything", () => {
    const early = new Date("2026-10-13T00:00:00Z");
    expect(effectiveCloseAt({ ...round, closedEarlyAt: early }, [], "สาขา")).toEqual(early);
  });
  it("delivers 45 days after close", () => {
    expect(deliveryDueAt(closesAt, 45).toISOString()).toBe("2026-11-30T16:59:00.000Z");
    expect(daysLeft(closesAt, new Date("2026-10-12T16:59:00Z"))).toBe(4);
  });
});
