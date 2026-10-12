import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { currentRound } from "@/lib/portal";
import { currentAdmin } from "@/lib/session";
import { employeeWhere } from "../../lib";

export async function GET(req: Request) {
  if (!(await currentAdmin())) return new Response("Unauthorized", { status: 401 });
  const f = Object.fromEntries(new URL(req.url).searchParams);
  const view = await currentRound();
  const roundId = view?.round.id ?? null;
  const rows = await db.employee.findMany({
    where: employeeWhere(f, roundId),
    include: { branch: true, orders: roundId ? { where: { roundId }, select: { orderNumber: true } } : false },
    orderBy: { employeeCode: "asc" },
  });
  const csv = toCsv([
    ["employee_code", "first_name", "last_name", "department", "sub_department", "gender", "position", "manager", "email", "phone", "branch", "status", "current_round_order"],
    ...rows.map((e) => [
      e.employeeCode,
      e.firstName,
      e.lastName,
      e.department,
      e.subDepartment,
      e.gender === "FEMALE" ? "F" : "M",
      e.position,
      e.managerName,
      e.email,
      e.phone,
      e.branch?.code,
      e.registeredAt ? "registered" : "not_registered",
      e.orders?.[0]?.orderNumber ?? "",
    ]),
  ]);
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ttb-employees.csv"` },
  });
}
