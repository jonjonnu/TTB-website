import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { yearsOfService } from "@/lib/entitlements";
import { STATUS_LABEL } from "@/lib/portal-labels";
import { currentAdmin } from "@/lib/session";
import { employeeWhere, selectedRound } from "../../lib";

export async function GET(req: Request) {
  if (!(await currentAdmin())) return new Response("Unauthorized", { status: 401 });
  const f = Object.fromEntries(new URL(req.url).searchParams);
  const { round } = await selectedRound(f.round);
  const rows = await db.employee.findMany({
    where: employeeWhere(f, round),
    include: { orders: round ? { where: { roundId: round.id }, select: { orderNumber: true, status: true, trackingNumber: true } } : false },
    orderBy: { employeeCode: "asc" },
  });
  const csv = toCsv([
    ["employee_code", "first_name", "last_name", "department", "sub_department", "gender", "position", "manager", "start_date", "years", "work_location", "work_address", "email", "phone", "registered", "order_number", "order_status", "tracking_number"],
    ...rows.map((e) => {
      const o = e.orders?.[0];
      return [
        e.employeeCode,
        e.firstName,
        e.lastName,
        e.department,
        e.subDepartment,
        e.gender === "FEMALE" ? "F" : "M",
        e.position,
        e.managerName,
        e.startDate?.toISOString().slice(0, 10),
        e.startDate ? yearsOfService(e.startDate) : "",
        e.workLocation,
        e.workAddress,
        e.email,
        e.phone,
        e.registeredAt ? "yes" : "no",
        o?.orderNumber,
        o ? STATUS_LABEL[o.status] : "",
        o?.trackingNumber,
      ];
    }),
  ]);
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ttb-employees.csv"` },
  });
}
