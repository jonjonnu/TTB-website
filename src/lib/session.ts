import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";

const EMPLOYEE_COOKIE = "ttb_session";
const ADMIN_COOKIE = "ttb_admin_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET must be set (at least 16 characters)");
  return new TextEncoder().encode(s);
}

async function sign(sub: string, kind: "employee" | "admin") {
  return new SignJWT({ kind })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

async function read(cookie: string, kind: "employee" | "admin"): Promise<string | null> {
  const token = (await cookies()).get(cookie)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.kind === kind && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

async function setCookie(name: string, value: string) {
  (await cookies()).set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function startEmployeeSession(employeeId: string) {
  await setCookie(EMPLOYEE_COOKIE, await sign(employeeId, "employee"));
}

export async function startAdminSession(adminId: string) {
  await setCookie(ADMIN_COOKIE, await sign(adminId, "admin"));
}

export async function endEmployeeSession() {
  (await cookies()).delete(EMPLOYEE_COOKIE);
}

export async function endAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function currentEmployee() {
  const id = await read(EMPLOYEE_COOKIE, "employee");
  if (!id) return null;
  const emp = await db.employee.findUnique({ where: { id } });
  return emp && emp.active && emp.registeredAt ? emp : null;
}

export async function requireEmployee() {
  const emp = await currentEmployee();
  if (!emp) redirect("/login");
  return emp;
}

export async function currentAdmin() {
  const id = await read(ADMIN_COOKIE, "admin");
  return id ? db.adminUser.findUnique({ where: { id } }) : null;
}

export async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
