import type { Prisma } from "@prisma/client";

export type EmployeeFilters = {
  q?: string;
  department?: string;
  subDepartment?: string;
  gender?: string;
  position?: string;
  registered?: string; // yes | no
  ordered?: string; // yes | no (current round)
};

export function employeeWhere(f: EmployeeFilters, roundId?: string | null): Prisma.EmployeeWhereInput {
  const where: Prisma.EmployeeWhereInput = { active: true };
  if (f.q) {
    where.OR = [
      { employeeCode: { contains: f.q } },
      { firstName: { contains: f.q, mode: "insensitive" } },
      { lastName: { contains: f.q, mode: "insensitive" } },
    ];
  }
  if (f.department) where.department = f.department;
  if (f.subDepartment) where.subDepartment = f.subDepartment;
  if (f.gender === "MALE" || f.gender === "FEMALE") where.gender = f.gender;
  if (f.position) where.position = f.position;
  if (f.registered === "yes") where.registeredAt = { not: null };
  if (f.registered === "no") where.registeredAt = null;
  if (roundId && f.ordered === "yes") where.orders = { some: { roundId } };
  if (roundId && f.ordered === "no") where.orders = { none: { roundId } };
  return where;
}
