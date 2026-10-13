// Sample data only: every name, phone number, address and email here is made up,
// and every price is a placeholder until Songsmai confirms real prices.
import { PrismaClient, type BenefitMode, type Gender, type OrderStatus, type PaymentMethod, type Product } from "@prisma/client";
import bcrypt from "bcryptjs";
import { entitlementsFor, yearsOfService } from "../src/lib/entitlements";

const db = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;

/** Bangkok-time date at hh:mm, `offset` days from today. */
function bkk(offset: number, hh: number, mm: number) {
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const d = new Date(`${today}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+07:00`);
  return new Date(d.getTime() + offset * DAY);
}
const yearsAgo = (y: number, extraDays = 0) => bkk(-Math.round(y * 365.25) - extraDays, 0, 0);

const products = [
  { sku: "TTB-JK-F", name: "เสื้อสูทหญิง สีกรมท่า", category: "สูท", price: 1290, sizes: ["XS", "S", "M", "L", "XL", "2XL"], lengths: ["สั้น", "ปกติ", "ยาว"], description: "ผ้าวูลผสม ทรงเข้ารูป ซับในเต็มตัว" },
  { sku: "TTB-SK-F", name: "กระโปรง สีกรมท่า", category: "กระโปรง", price: 590, sizes: ["24", "26", "28", "30", "32", "34"], lengths: ["สั้น", "ปกติ", "ยาว"], description: "กระโปรงทรงสอบ ผ่าหลัง" },
  { sku: "TTB-SH-F", name: "เสื้อเชิ้ตขาวหญิง แขนยาว", category: "เสื้อ", price: 450, sizes: ["XS", "S", "M", "L", "XL", "2XL"], lengths: [], description: "ผ้าคอตตอนผสม รีดง่าย" },
  { sku: "TTB-SC-F", name: "ผ้าพันคอ ลายองค์กร", category: "อุปกรณ์", price: 350, sizes: ["Free size"], lengths: [], description: "ผ้าซาตินพิมพ์ลาย TTB", departments: ["Branch", "Wealth"] },
  { sku: "TTB-JK-M", name: "เสื้อสูทชาย สีกรมท่า", category: "สูท", price: 1490, sizes: ["S", "M", "L", "XL", "2XL", "3XL"], lengths: ["สั้น", "ปกติ", "ยาว"], description: "ผ้าวูลผสม ทรงสลิม" },
  { sku: "TTB-PT-M", name: "กางเกงสแล็คชาย สีกรมท่า", category: "กางเกง", price: 690, sizes: ["28", "30", "32", "34", "36", "38"], lengths: ["สั้น", "ปกติ", "ยาว"], description: "ขากระบอกเล็ก" },
  { sku: "TTB-SH-M", name: "เสื้อเชิ้ตขาวชาย แขนยาว", category: "เสื้อ", price: 450, sizes: ["S", "M", "L", "XL", "2XL", "3XL"], lengths: [], description: "ผ้าคอตตอนผสม รีดง่าย" },
  { sku: "TTB-TIE", name: "เนคไท ลายองค์กร", category: "อุปกรณ์", price: 390, sizes: ["Free size"], lengths: [], description: "ผ้าไหมผสม", departments: ["Branch", "Wealth"] },
  { sku: "TTB-BL-F", name: "เสื้อเบลาส์ Back Office", category: "เสื้อ", price: 690, sizes: ["XS", "S", "M", "L", "XL", "2XL"], lengths: [], description: "ผ้าโพลีเอสเตอร์ไม่ยับ", departments: ["Back Office"], personalSale: false },
  { sku: "TTB-POLO", name: "เสื้อโปโล TTB", category: "เสื้อ", price: 390, sizes: ["S", "M", "L", "XL", "2XL"], lengths: [], description: "ใส่วันศุกร์ ผ้าระบายอากาศ" },
  { sku: "TTB-DR-F", name: "ชุดเดรส สีกรมท่า", category: "ชุดเดรส", price: 1590, sizes: ["XS", "S", "M", "L", "XL"], lengths: ["ปกติ", "ยาว"], description: "ซื้อได้เฉพาะสั่งซื้อส่วนตัว", creditAllowed: false },
];

const firstF = ["ณัฐธิดา", "สุภาพร", "กมลชนก", "ปิยะนุช", "อรอุมา", "ศิริพร", "จิราพร", "พิมพ์ชนก", "วรรณิภา", "ธิดารัตน์", "ชนิดา", "มาลัย"];
const firstM = ["ธนกร", "ปกรณ์", "วีรยุทธ", "สมชาย", "อนุชา", "ภาณุพงศ์", "กิตติพัฒน์", "ณัฐวุฒิ", "ศุภชัย", "วรวิทย์", "ชยพล", "ธีรวัฒน์"];
const last = ["ศรีสุข", "ใจดี", "มั่นคง", "รุ่งเรือง", "แสงทอง", "บุญมา", "สุขสวัสดิ์", "ทองดี", "วงศ์ไทย", "พรหมมา", "เจริญผล", "ศักดิ์สิทธิ์"];
const orgs = [
  { department: "Branch", subDepartment: "บริการลูกค้า", position: "Teller" },
  { department: "Branch", subDepartment: "บริการลูกค้า", position: "ผู้จัดการสาขา" },
  { department: "Branch", subDepartment: "สินเชื่อ", position: "เจ้าหน้าที่สินเชื่อ" },
  { department: "Wealth", subDepartment: "Wealth Advisory", position: "Wealth Advisor" },
  { department: "Back Office", subDepartment: "ทรัพยากรบุคคล", position: "เจ้าหน้าที่" },
  { department: "Back Office", subDepartment: "การตลาด", position: "เจ้าหน้าที่" },
  { department: "Back Office", subDepartment: "เทคโนโลยี", position: "เจ้าหน้าที่" },
];
const locations = [
  { workLocation: "สาขาสีลม", workAddress: "99 ถ.สีลม แขวงสุริยวงศ์ เขตบางรัก กรุงเทพฯ 10500" },
  { workLocation: "สำนักงานใหญ่ พหลโยธิน", workAddress: "3000 ถ.พหลโยธิน แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900" },
  { workLocation: "สาขาบางนา", workAddress: "88 ถ.บางนา-ตราด แขวงบางนา เขตบางนา กรุงเทพฯ 10260" },
  { workLocation: "สาขาเชียงใหม่", workAddress: "12 ถ.ช้างคลาน ต.ช้างคลาน อ.เมือง จ.เชียงใหม่ 50100" },
  { workLocation: "สาขาขอนแก่น", workAddress: "45 ถ.มิตรภาพ ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000" },
];
const HQ = locations[1];

type Emp = { id: string; employeeCode: string; gender: Gender; department: string; position: string; startDate: Date | null; workLocation: string | null; workAddress: string | null };
type Round = { id: string; type: "BIG_LOT" | "NEW_JOINERS"; year: number; opensAt: Date };

async function main() {
  // On deploy (vercel-build) only fill an empty database; never wipe one that already has data.
  if (process.env.SEED_IF_EMPTY === "1" && (await db.employee.count()) > 0) {
    console.log("Database already has data, skipping sample data.");
    return;
  }
  console.log("Clearing old data…");
  await db.$transaction([
    db.notification.deleteMany(),
    db.outboundMessage.deleteMany(),
    db.exchangeRequest.deleteMany(),
    db.payment.deleteMany(),
    db.orderEvent.deleteMany(),
    db.orderItem.deleteMany(),
    db.order.deleteMany(),
    db.cartItem.deleteMany(),
    db.roundExtension.deleteMany(),
    db.roundMember.deleteMany(),
    db.roundPolicy.deleteMany(),
    db.orderRound.deleteMany(),
    db.entitlementRule.deleteMany(),
    db.product.deleteMany(),
    db.otpCode.deleteMany(),
    db.employee.deleteMany(),
    db.adminUser.deleteMany(),
    db.setting.deleteMany(),
  ]);

  const productRows = await Promise.all(
    products.map((p, i) =>
      db.product.create({ data: { departments: [], creditAllowed: true, personalSale: true, ...p, stock: 200 + ((i * 37) % 300), sortOrder: i } }),
    ),
  );
  const P = Object.fromEntries(productRows.map((p) => [p.sku, p]));

  // Fixed entitlements for Branch and Wealth (Back Office uses credit).
  await db.entitlementRule.createMany({
    data: [
      ...["Branch", "Wealth"].flatMap((department) => [
        { productId: P["TTB-JK-F"].id, gender: "FEMALE" as Gender, department, quantity: 1 },
        { productId: P["TTB-SK-F"].id, gender: "FEMALE" as Gender, department, quantity: 2 },
        { productId: P["TTB-SH-F"].id, gender: "FEMALE" as Gender, department, quantity: 3 },
        { productId: P["TTB-SC-F"].id, gender: "FEMALE" as Gender, department, quantity: 1 },
        { productId: P["TTB-JK-M"].id, gender: "MALE" as Gender, department, quantity: 1 },
        { productId: P["TTB-PT-M"].id, gender: "MALE" as Gender, department, quantity: 2 },
        { productId: P["TTB-SH-M"].id, gender: "MALE" as Gender, department, quantity: 3 },
      ]),
      { productId: P["TTB-TIE"].id, gender: "MALE", department: "Branch", minYears: 5, quantity: 1 },
      { productId: P["TTB-TIE"].id, gender: "MALE", department: "Wealth", quantity: 1 },
      { productId: P["TTB-JK-F"].id, gender: "FEMALE", department: "Wealth", quantity: 2 },
      { productId: P["TTB-JK-M"].id, gender: "MALE", department: "Wealth", quantity: 2 },
      { productId: P["TTB-JK-F"].id, gender: "FEMALE", position: "ผู้จัดการสาขา", quantity: 2 },
      { productId: P["TTB-JK-M"].id, gender: "MALE", position: "ผู้จัดการสาขา", quantity: 2 },
    ],
  });
  const rules = await db.entitlementRule.findMany();

  const pw = await bcrypt.hash("ttb12345", 10);
  console.log("Creating employees…");
  const employees: Emp[] = [];
  // Demo employees: one Back Office (credit), one Branch (fixed, 6 years so the tie rule applies).
  employees.push(
    await db.employee.create({
      data: {
        employeeCode: "1100231",
        firstName: "ณัฐธิดา",
        lastName: "ศรีสุข",
        gender: "FEMALE",
        department: "Back Office",
        subDepartment: "ทรัพยากรบุคคล",
        position: "เจ้าหน้าที่",
        managerName: "วรรณา ก.",
        startDate: yearsAgo(3, 120),
        ...HQ,
        email: "nattida.demo@example.com",
        phone: "0810004521",
        passwordHash: pw,
        registeredAt: bkk(-300, 10, 0),
      },
    }),
    await db.employee.create({
      data: {
        employeeCode: "1100232",
        firstName: "ปกรณ์",
        lastName: "ใจดี",
        gender: "MALE",
        department: "Branch",
        subDepartment: "บริการลูกค้า",
        position: "Teller",
        managerName: "สมศรี ร.",
        startDate: yearsAgo(6, 40),
        ...locations[0],
        email: "pakorn.demo@example.com",
        phone: "0810004522",
        homeAddress: "123/45 ซ.สุขุมวิท 50 แขวงพระโขนง เขตคลองเตย กรุงเทพฯ 10110",
        passwordHash: pw,
        registeredAt: bkk(-400, 10, 0),
      },
    }),
  );
  for (let i = 0; i < 70; i++) {
    const gender: Gender = i % 2 === 0 ? "FEMALE" : "MALE";
    const org = orgs[i % orgs.length];
    const registered = i < 52 || (i >= 60 && i < 64);
    const loc = org.department === "Back Office" ? HQ : locations[i % locations.length];
    employees.push(
      await db.employee.create({
        data: {
          employeeCode: String(1100300 + i),
          firstName: (gender === "FEMALE" ? firstF : firstM)[i % 12],
          lastName: last[(i * 5) % 12],
          gender,
          ...org,
          managerName: "วรรณา ก.",
          // Mostly long-serving; the last few joined recently (New Joiners candidates).
          startDate: i >= 64 ? bkk(-(i - 63) * 9, 0, 0) : i >= 60 ? bkk(-100 - (i - 60) * 10, 0, 0) : yearsAgo(1 + (i % 12), i * 7),
          ...loc,
          email: `employee${i + 1}@example.com`,
          phone: `08100${String(10000 + i).slice(-5)}`,
          passwordHash: registered ? pw : null,
          registeredAt: registered ? bkk(-200 + i, 9, 0) : null,
        },
      }),
    );
  }

  // In the HR list but not signed up yet, for testing OTP registration.
  await db.employee.create({
    data: {
      employeeCode: "1100999",
      firstName: "ทดลอง",
      lastName: "ลงทะเบียน",
      gender: "MALE",
      department: "Branch",
      subDepartment: "บริการลูกค้า",
      position: "Teller",
      startDate: bkk(-20, 0, 0),
      ...locations[2],
      email: "signup.demo@example.com",
      phone: "0810009999",
    },
  });

  console.log("Creating rounds and orders…");
  const year = Number(bkk(0, 12, 0).toISOString().slice(0, 4));
  const policies = (credit: number) => [
    { department: "Branch", mode: "FIXED" as BenefitMode, creditAmount: 0 },
    { department: "Wealth", mode: "FIXED" as BenefitMode, creditAmount: 0 },
    { department: "Back Office", mode: "CREDIT" as BenefitMode, creditAmount: credit },
  ];
  const makeRound = (type: Round["type"], name: string, y: number, open: number, extra: object = {}) =>
    db.orderRound.create({
      data: {
        type,
        name,
        year: y,
        opensAt: bkk(open, 9, 0),
        closesAt: bkk(open + 6, 23, 59),
        originalClosesAt: bkk(open + 6, 23, 59),
        deliveryDays: 45,
        policies: { create: policies(2000) },
        ...extra,
      },
    });

  const counter = new Map<string, number>();
  const nextNumber = (prefix: string) => {
    const n = (counter.get(prefix) ?? 0) + 1;
    counter.set(prefix, n);
    return `${prefix}${String(n).padStart(4, "0")}`;
  };
  const prefixOf = (r: Round) => `${r.type === "BIG_LOT" ? "BL" : "NJ"}${String(r.year).slice(-2)}-`;

  // Last year's Big Lot: everyone received it.
  const lastBigLot = await makeRound("BIG_LOT", `Big Lot ${year - 1}`, year - 1, -365, { packing: "PER_LOCATION" });
  const oldTimers = employees.filter((e) => e.startDate && e.startDate < lastBigLot.opensAt).slice(0, 45);
  for (const [i, emp] of oldTimers.entries()) {
    await createWelfareOrder(lastBigLot, nextNumber(prefixOf(lastBigLot)), emp, "DELIVERED", bkk(-363, 10, i), `JT${year - 1}${String(700000 + i)}`);
  }

  // A New Joiners round two months ago, for people who started after last year's Big Lot.
  const njMembers = employees.filter((e) => e.startDate && e.startDate > lastBigLot.opensAt && e.startDate < bkk(-75, 0, 0)).slice(0, 5);
  const nj = await makeRound("NEW_JOINERS", `New Joiners ส.ค. ${year}`, year, -60, { members: { create: njMembers.map((e) => ({ employeeId: e.id })) } });
  for (const [i, emp] of njMembers.entries()) {
    await createWelfareOrder(nj, nextNumber(prefixOf(nj)), emp, i < 3 ? "DELIVERED" : "SHIPPING", bkk(-58, 11, i), `JT${year}${String(500000 + i)}`);
  }

  // This year's Big Lot, open now. About half have ordered; neither demo employee has, so the demo can order.
  const current = await makeRound("BIG_LOT", `Big Lot ${year}`, year, -2, { closesAt: bkk(4, 23, 59), originalClosesAt: bkk(4, 23, 59) });
  const ordering = employees.slice(2, 54).filter((_, i) => i % 2 === 0);
  for (const [i, emp] of ordering.entries()) {
    await createWelfareOrder(current, nextNumber(prefixOf(current)), emp, "PLACED", new Date(bkk(-1, 9, 0).getTime() + i * 3 * 60_000));
  }

  // Personal store orders.
  const pakorn = employees[1];
  const po1 = await createPersonalOrder(nextNumber("PO-"), pakorn, [[P["TTB-POLO"], 2, "L"], [P["TTB-SH-M"], 1, "L"]], "HOME", "SHIPPING", bkk(-12, 15, 0), "JT2026880011");
  await createPersonalOrder(nextNumber("PO-"), employees[4], [[P["TTB-DR-F"], 1, "M"]], "WORKPLACE", "PRODUCING", bkk(-5, 13, 0));

  // An exchange request on the Branch demo's delivered Big Lot order.
  const pakornLast = await db.order.findFirst({ where: { employeeId: pakorn.id, roundId: lastBigLot.id } });
  if (pakornLast) {
    await db.exchangeRequest.create({
      data: { orderId: pakornLast.id, employeeId: pakorn.id, reason: "WRONG_SIZE", details: "กางเกงเอว 32 คับไป ขอเปลี่ยนเป็น 34", createdAt: bkk(-300, 10, 0) },
    });
  }

  const demoNotes = (empId: string) => [
    { employeeId: empId, kind: "ROUND_OPEN", title: "เปิดให้สั่งจอง", body: `Big Lot ${year} เปิดรับแล้ว ถึงวันที่ปิดรับ เข้าระบบเพื่อเลือกไซส์`, href: "/", createdAt: bkk(-2, 9, 0) },
  ];
  await db.notification.createMany({
    data: [
      ...demoNotes(employees[0].id),
      ...demoNotes(pakorn.id),
      { employeeId: pakorn.id, kind: "STATUS", title: "อยู่ระหว่างจัดส่ง", body: `คำสั่งซื้อ ${po1.orderNumber}: อยู่ระหว่างจัดส่ง · J&T ${po1.trackingNumber}`, href: `/orders/${po1.id}`, createdAt: bkk(-3, 10, 0) },
    ],
  });

  await db.adminUser.createMany({
    data: [
      { email: "owner@example.com", name: "Songsmai Owner", organization: "Songsmai · ฝ่ายผลิต", role: "OWNER", passwordHash: await bcrypt.hash("admin12345", 10) },
      { email: "hr@example.com", name: "ฝ่ายบุคคล TTB", organization: "TTB · ฝ่ายบุคคล", role: "ADMIN", passwordHash: await bcrypt.hash("admin12345", 10) },
    ],
  });

  console.log("Done.");
  console.log("Employee logins (password ttb12345): 1100231 Back Office credit · 1100232 Branch fixed");
  console.log("Sign-up test: employee code 1100999");
  console.log("Admin login: owner@example.com / admin12345");

  // ----- helpers that need the product map -----

  async function createWelfareOrder(round: Round, orderNumber: string, emp: Emp, status: OrderStatus, at: Date, tracking?: string) {
    const mode: BenefitMode = emp.department === "Back Office" ? "CREDIT" : "FIXED";
    const size = (p: Product) => p.sizes[Math.min(2, p.sizes.length - 1)];
    let lines: { p: Product; qty: number; entitled: number }[];
    if (mode === "FIXED") {
      const ent = entitlementsFor(rules, { ...emp, years: yearsOfService(emp.startDate, round.opensAt) });
      lines = productRows.filter((p) => ent.has(p.id)).map((p) => ({ p, qty: ent.get(p.id)!, entitled: ent.get(p.id)! }));
    } else {
      // Back Office picks: some stay within ฿2,000, some go over and pay the difference.
      const picks =
        emp.gender === "FEMALE"
          ? orderNumber.endsWith("2") ? [[P["TTB-BL-F"], 2], [P["TTB-POLO"], 1]] : [[P["TTB-JK-F"], 1], [P["TTB-SK-F"], 1], [P["TTB-SH-F"], 1]]
          : orderNumber.endsWith("3") ? [[P["TTB-SH-M"], 2], [P["TTB-POLO"], 2]] : [[P["TTB-JK-M"], 1], [P["TTB-PT-M"], 1], [P["TTB-SH-M"], 1]];
      lines = (picks as [Product, number][]).map(([p, qty]) => ({ p, qty, entitled: 0 }));
    }
    const subtotal = lines.reduce((s, l) => s + (l.qty - l.entitled) * l.p.price, 0);
    const creditUsed = mode === "CREDIT" ? Math.min(subtotal, 2000) : 0;
    const total = subtotal - creditUsed;
    const method: PaymentMethod = (["PROMPTPAY", "MOBILE_BANKING", "CREDIT_CARD", "DEBIT_CARD"] as const)[Number(orderNumber.slice(-1)) % 4];
    return db.order.create({
      data: {
        orderNumber,
        kind: "WELFARE",
        employeeId: emp.id,
        roundId: round.id,
        benefitMode: mode,
        status,
        deliveryMethod: "WORKPLACE",
        deliveryAddress: [emp.workLocation, emp.workAddress].filter(Boolean).join(" · "),
        subtotal,
        creditUsed,
        total,
        amountPaid: total,
        paymentStatus: total > 0 ? "PAID" : "NOT_REQUIRED",
        paymentMethod: total > 0 ? method : null,
        carrier: tracking ? "J&T" : null,
        trackingNumber: tracking ?? null,
        createdAt: at,
        items: {
          create: lines.map((l) => ({
            productId: l.p.id,
            size: size(l.p),
            length: l.p.lengths.length ? "ปกติ" : null,
            quantity: l.qty,
            entitledQty: l.entitled,
            extraQty: l.qty - l.entitled,
            unitPrice: l.p.price,
          })),
        },
        events: { create: eventsUpTo(status, at, true) },
        payments: total > 0 ? { create: { amount: total, method, status: "PAID", provider: "mock", providerRef: `SIM-${orderNumber}`, paidAt: at, createdAt: at } } : undefined,
      },
    });
  }

  async function createPersonalOrder(
    orderNumber: string,
    emp: Emp,
    picks: [Product, number, string][],
    delivery: "WORKPLACE" | "HOME",
    status: OrderStatus,
    at: Date,
    tracking?: string,
  ) {
    const subtotal = picks.reduce((s, [p, q]) => s + p.price * q, 0);
    const deliveryFee = delivery === "HOME" ? 150 : 0;
    const total = subtotal + deliveryFee;
    const home = await db.employee.findUnique({ where: { id: emp.id }, select: { homeAddress: true } });
    return db.order.create({
      data: {
        orderNumber,
        kind: "PERSONAL",
        employeeId: emp.id,
        status,
        deliveryMethod: delivery,
        deliveryAddress: delivery === "HOME" ? home?.homeAddress : [emp.workLocation, emp.workAddress].filter(Boolean).join(" · "),
        subtotal,
        deliveryFee,
        total,
        amountPaid: total,
        paymentStatus: "PAID",
        paymentMethod: "PROMPTPAY",
        carrier: tracking ? "J&T" : null,
        trackingNumber: tracking ?? null,
        createdAt: at,
        items: { create: picks.map(([p, q, s]) => ({ productId: p.id, size: s, length: p.lengths.length ? "ปกติ" : null, quantity: q, entitledQty: 0, extraQty: q, unitPrice: p.price })) },
        events: { create: eventsUpTo(status, at, false) },
        payments: { create: { amount: total, method: "PROMPTPAY", status: "PAID", provider: "mock", providerRef: `SIM-${orderNumber}`, paidAt: at, createdAt: at } },
      },
    });
  }
}

const STEPS: [OrderStatus, string][] = [
  ["PLACED", "ยืนยันคำสั่งซื้อ"],
  ["ROUND_CLOSED", "ปิดรอบสั่งซื้อ"],
  ["PRODUCING", "อยู่ระหว่างผลิต"],
  ["SHIPPING", "อยู่ระหว่างจัดส่ง"],
  ["DELIVERED", "จัดส่งสำเร็จ"],
];

function eventsUpTo(status: OrderStatus, at: Date, welfare: boolean) {
  const steps = welfare ? STEPS : STEPS.filter(([s]) => s !== "ROUND_CLOSED");
  const upto = steps.findIndex(([s]) => s === status);
  return steps.slice(0, upto + 1).map(([s, message], i) => ({ status: s, message, createdAt: new Date(at.getTime() + i * 10 * DAY) }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
