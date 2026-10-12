import { db } from "@/lib/db";
import { messaging } from "@/lib/providers/messaging";

type NotifyInput = {
  kind: string;
  title: string;
  body: string;
  href?: string;
};

/** In-app notification plus email/SMS according to the employee's preferences. */
export async function notifyEmployee(employeeId: string, n: NotifyInput) {
  const emp = await db.employee.findUnique({ where: { id: employeeId } });
  if (!emp) return;
  await db.notification.create({ data: { employeeId, ...n } });
  const provider = messaging();
  const text = `${n.title}: ${n.body}`;
  if (emp.notifyEmail && emp.email) {
    await provider.send({ channel: "EMAIL", to: emp.email, subject: `TTB Uniform · ${n.title}`, body: text });
  }
  if (emp.notifySms && emp.phone) {
    await provider.send({ channel: "SMS", to: emp.phone, body: `TTB Uniform: ${text}` });
  }
}

export async function notifyMany(employeeIds: string[], n: NotifyInput & { sendExternal?: boolean }) {
  const { sendExternal = true, ...rest } = n;
  if (!sendExternal) {
    await db.notification.createMany({ data: employeeIds.map((employeeId) => ({ employeeId, ...rest })) });
    return;
  }
  for (const id of employeeIds) await notifyEmployee(id, rest);
}
