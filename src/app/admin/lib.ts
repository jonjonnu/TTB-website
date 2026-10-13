import { db } from "@/lib/db";
import { viewOf } from "@/lib/portal";
import type { OrderStatus, Prisma } from "@prisma/client";

const YEAR = 365.25 * 24 * 60 * 60 * 1000;

/** The round an admin screen is about: ?round=… or the newest one. */
export async function selectedRound(roundId?: string) {
  const rounds = await db.orderRound.findMany({ include: { extensions: true, policies: true }, orderBy: { opensAt: "desc" } });
  const round = rounds.find((r) => r.id === roundId) ?? rounds.find((r) => r.type === "BIG_LOT") ?? rounds[0] ?? null;
  return { rounds, round, view: round ? viewOf(round) : null };
}

/** Employees who can order in a round: everyone for Big Lot, the picked people for New Joiners. */
export function eligibleWhere(round: { id: string; type: string } | null): Prisma.EmployeeWhereInput {
  if (!round) return { active: true };
  return round.type === "NEW_JOINERS" ? { active: true, roundMembers: { some: { roundId: round.id } } } : { active: true };
}

export type EmployeeFilters = {
  tab?: string; // all | ordered | not-ordered | unregistered
  q?: string;
  department?: string;
  subDepartment?: string;
  workLocation?: string;
  years?: string; // 0-1 | 1-3 | 3-5 | 5+
  status?: string; // order status in the round
  gender?: string;
  position?: string;
};

export function employeeWhere(f: EmployeeFilters, round: { id: string; type: string } | null): Prisma.EmployeeWhereInput {
  const and: Prisma.EmployeeWhereInput[] = [eligibleWhere(round)];
  if (f.q) {
    and.push({
      OR: [
        { employeeCode: { contains: f.q } },
        { firstName: { contains: f.q, mode: "insensitive" } },
        { lastName: { contains: f.q, mode: "insensitive" } },
        ...(round ? [{ orders: { some: { roundId: round.id, trackingNumber: { contains: f.q } } } }] : []),
      ],
    });
  }
  if (f.department) and.push({ department: f.department });
  if (f.subDepartment) and.push({ subDepartment: f.subDepartment });
  if (f.workLocation) and.push({ workLocation: f.workLocation });
  if (f.gender === "MALE" || f.gender === "FEMALE") and.push({ gender: f.gender });
  if (f.position) and.push({ position: f.position });
  if (f.years) {
    const [min, max] = f.years === "5+" ? [5, 99] : f.years.split("-").map(Number);
    const now = Date.now();
    and.push({ startDate: { lte: new Date(now - min * YEAR), gt: new Date(now - max * YEAR) } });
  }
  if (round) {
    if (f.tab === "ordered") and.push({ orders: { some: { roundId: round.id } } });
    if (f.tab === "not-ordered") and.push({ registeredAt: { not: null }, orders: { none: { roundId: round.id } } });
    if (f.status) and.push({ orders: { some: { roundId: round.id, status: f.status as OrderStatus } } });
  }
  if (f.tab === "unregistered") and.push({ registeredAt: null });
  return { AND: and };
}
