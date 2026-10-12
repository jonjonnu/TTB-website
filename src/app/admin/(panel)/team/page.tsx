import { db } from "@/lib/db";
import { thDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { Badge, Card, Input, Label, Select } from "@/components/ui";
import { addAdmin, removeAdmin } from "../../actions";
import { ActionForm } from "../form-bits";

export default async function TeamPage() {
  const me = await requireAdmin();
  const admins = await db.adminUser.findMany({ orderBy: { createdAt: "asc" } });
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">ทีมผู้ดูแล</h1>
        <p className="text-sm text-muted">Owner จัดการได้ทุกอย่าง · Admin ทำได้ทุกอย่างยกเว้นจัดการผู้ดูแลคนอื่น</p>
      </div>
      <Card>
        {admins.map((a) => (
          <div key={a.id} className="flex items-center justify-between border-b border-line px-4 py-3 last:border-0">
            <div>
              <p className="font-semibold">
                {a.name} {a.id === me.id && <span className="text-xs font-normal text-muted">(คุณ)</span>}
              </p>
              <p className="text-xs text-muted">
                {a.email} · เพิ่มเมื่อ {thDate(a.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={a.role === "OWNER" ? "navy" : "gray"}>{a.role === "OWNER" ? "Owner" : "Admin"}</Badge>
              {me.role === "OWNER" && a.id !== me.id && (
                <form action={removeAdmin}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="text-xs text-bad">ลบ</button>
                </form>
              )}
            </div>
          </div>
        ))}
      </Card>
      {me.role === "OWNER" && (
        <Card className="p-4">
          <h2 className="font-semibold">เพิ่มผู้ดูแล</h2>
          <ActionForm action={addAdmin} submit="เพิ่ม" className="mt-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>ชื่อ</Label>
                <Input name="name" required />
              </div>
              <div>
                <Label>อีเมล</Label>
                <Input name="email" type="email" required />
              </div>
              <div>
                <Label>รหัสผ่านเริ่มต้น</Label>
                <Input name="password" type="password" minLength={8} required />
              </div>
              <div>
                <Label>บทบาท</Label>
                <Select name="role" defaultValue="ADMIN">
                  <option value="ADMIN">Admin</option>
                  <option value="OWNER">Owner</option>
                </Select>
              </div>
            </div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
