# TTB Uniform Portal

Web app where TTB employees order their uniforms (เครื่องแบบพนักงาน), built for Songsmai.
It follows the mockup in the TTB project (`TTB-Employee-Web-App-Mockup.pdf`). All names, prices and dates in the sample data are made up.

## What it does

**Three kinds of orders**
- **Big Lot**: the annual welfare round. Open 7 days, then closed for checking, then delivered to the employee's work location within 45 days.
- **New Joiners**: a monthly round admin opens for hand-picked new staff, with the same benefits as the latest Big Lot.
- **Personal store**: any employee can buy at full price at any time, delivered free to work or to home for a fee.

**Benefits per department, set per round**
- Branch and Wealth get **fixed items** by position, gender and years of service (e.g. a tie after 5 years).
- Back Office gets a **฿2,000 credit** to spend on products marked "ใช้เครดิตได้". Anything over is paid by QR PromptPay, mobile banking, credit or debit card. Credit doesn't carry over.
- One switch turns credit off for every department in a round.

**Employees (phone-first, Thai)**
- Sign up with their employee ID and a 6-digit OTP sent to the phone or email HR has on file. Forgot-password uses the same flow.
- The home page shows department, position, years of service, the round timeline, and either remaining credit or their fixed items.
- Pick size, length and quantity; edit the order until the round closes (pay the difference, or a refund is flagged).
- Status in 5 steps (ยืนยัน, ปิดรอบ, อยู่ระหว่างผลิต, อยู่ระหว่างจัดส่ง, จัดส่งสำเร็จ) with J&T tracking numbers, notifications, size guide, and exchange requests (wrong size, defect, wrong item).
- Songsmai Call Center 02-433-9881 and LINE @songsmai on every page.

**Admin (desktop)** at `/admin`, for both TTB HR and Songsmai
- Dashboard with production and shipping progress and 8 CSV reports (usage, extras, by department, by location, production, shipping, outstanding, stock).
- Employees: filters (department, work location, years of service, status…), HR CSV import, bulk extend/notify/status, tracking-number CSV import.
- Rounds: benefit mode and credit per department, credit switch, packing mode (per person / department / location), extend the deadline for everyone, one department or chosen people.
- New Joiners, entitlement rules, products (price, stock, credit and personal-sale flags), orders and exchanges, admin team with organisation and roles.

## Run it on your computer

Needs Node 22 and Postgres.

```bash
cp .env.example .env          # then edit DATABASE_URL and AUTH_SECRET
npm install
npx prisma migrate deploy
npm run db:seed               # sample data
npm run dev                   # http://localhost:3000
```

Sample logins (from the seed):
- Back Office employee (credit): `1100231` / `ttb12345`
- Branch employee (fixed items): `1100232` / `ttb12345`
- Try sign-up with employee ID `1100999` (the OTP is shown on screen in test mode)
- Admin: `owner@example.com` / `admin12345`

`npm test` runs the unit tests; `npm run typecheck` checks types.

## Put it online (Vercel)

1. Sign in at vercel.com with GitHub and **Import** this repository.
2. Before the first deploy, open **Storage → Create → Neon (Postgres)** and connect it; this sets `DATABASE_URL`.
3. In **Settings → Environment Variables** add `AUTH_SECRET` (any random text, 16+ characters) and `SHOW_TEST_OTP=true`. SMS and payment default to the mock providers.
4. Deploy. The build creates the database tables and, if the database is empty, loads the sample data (`vercel-build`). It never overwrites a database that already has data.
5. To take real payments with Omise, see below.
6. Later, add the domain (e.g. `ttb.songsmai1938.com`) under **Settings → Domains**.

## Payments with Omise

Without setup the app uses a pretend payment screen. To use Omise (Opn Payments):

1. In the Omise Dashboard open **Keys** and copy the public key (`pkey_…`) and secret key (`skey_…`). Start with the **test** keys.
2. In Vercel **Settings → Environment Variables** add `PAYMENT_PROVIDER=omise`, `OMISE_PUBLIC_KEY` and `OMISE_SECRET_KEY`, then redeploy.
3. Optional but recommended: in the Omise Dashboard **Webhooks**, set `https://<your-site>/api/omise/webhook`. If a webhook address is already set there (for example for your Shopify store), leave it as it is; the app also checks with Omise when the employee returns to the payment page.
4. Make sure PromptPay, mobile banking and cards are enabled on the Omise account.

PromptPay shows Omise's QR and the page updates itself once paid. Mobile banking opens the bank app. Card details are sent from the browser straight to Omise (Omise.js); the server only gets a one-time token, then 3-D Secure runs if the card needs it. Every payment is confirmed by asking Omise directly, never by trusting the browser or the webhook body.

## Code map

- `prisma/schema.prisma` data model, `prisma/seed.ts` sample data
- `src/app/(auth)` login, sign-up, OTP, forgot password
- `src/app/(app)` employee app; `actions.ts` holds cart, checkout, payment and edit logic
- `src/app/admin` admin panel; `actions.ts` holds rounds, extensions, imports, status updates
- `src/lib/entitlements.ts`, `src/lib/rounds.ts` pure rules (quota, pricing, timeline) with tests
- `src/lib/providers/` the OTP/SMS/email and payment hook-in points (`omise.ts` for Omise); `src/lib/payments.ts` confirms payments
