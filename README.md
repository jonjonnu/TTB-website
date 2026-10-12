# TTB Uniform Portal

Web app where TTB employees order their uniforms (เครื่องแบบพนักงาน), built for Songsmai.
It follows the mockup in the TTB project (`TTB-Employee-Web-App-Mockup.pdf`). All names, prices and dates in the sample data are made up.

## What it does

**Employees (phone-first, Thai)**
- Sign up with their employee ID; a 6-digit OTP is sent to the phone or email HR has on file. Forgot-password uses the same OTP flow.
- Home page shows their department, position, the current ordering round (open 7 days → closed for review → delivered to branch within 45 days) and only the uniforms they're entitled to.
- Pick size, length and quantity per item. Anything beyond the free quota, or items outside their entitlement, is charged.
- Checkout: pick up at a branch (free) or deliver to home (extra fee). Pay extras by PromptPay QR or card.
- Edit the order until the round closes (pay the difference, or a refund is flagged for Songsmai).
- Order status in 6 steps, order history, notifications (in-app + email/SMS), account page with an entitlement table.

**Admin (desktop)** at `/admin`
- Employees and status: filter by department, sub-department, gender, position, registered, ordered; CSV export and CSV import.
- Ordering rounds: create, edit dates, close early, remind people who haven't ordered, and **extend the deadline** (for everyone or one department) with the delivery date recalculated and employees notified.
- Entitlement rules, products and prices, orders (bulk status updates that notify employees, production CSV), admin team with Owner/Admin roles.

## Not live yet (placeholders)

| Piece | Today | To go live |
| --- | --- | --- |
| OTP and notification SMS/email | `mock` provider: nothing is sent, messages are stored in the `OutboundMessage` table, and with `SHOW_TEST_OTP=true` the code is shown on the OTP screen | Pick SMS (e.g. ThaiBulkSMS) and email (e.g. Resend) providers and add them in `src/lib/providers/messaging.ts` |
| Payment | `mock` provider: sample QR, a "simulate payment" button | Pick a Thai gateway (e.g. Opn/Omise, 2C2P, GB Prime Pay) and add it in `src/lib/providers/payment.ts` |
| Product photos, prices, delivery fee, size chart | Placeholders | Edit in admin → สินค้า / รอบสั่งซื้อ |
| LINE notifications | Toggle only | Needs a LINE Official Account |

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
- Employee: `1100231` / `ttb12345`
- Try sign-up with employee ID `1100999` (the OTP is shown on screen in test mode)
- Admin: `owner@example.com` / `admin12345`

`npm test` runs the unit tests; `npm run typecheck` checks types.

## Put it online (Vercel)

1. Sign in at vercel.com with GitHub and **Import** this repository.
2. In the project, open **Storage → Create → Neon (Postgres)** and connect it; this sets `DATABASE_URL`.
3. In **Settings → Environment Variables** add `AUTH_SECRET` (any long random text), `OTP_PROVIDER=mock`, `PAYMENT_PROVIDER=mock`, `SHOW_TEST_OTP=true`.
4. Deploy. The build applies the database tables automatically (`vercel-build`).
5. Load sample data once: run `npm run db:seed` locally with `DATABASE_URL` pointing at the Neon database.
6. Later, add the domain (e.g. `ttb.songsmai1938.com`) under **Settings → Domains**.

## Code map

- `prisma/schema.prisma` data model, `prisma/seed.ts` sample data
- `src/app/(auth)` login, sign-up, OTP, forgot password
- `src/app/(app)` employee app; `actions.ts` holds cart, checkout, payment and edit logic
- `src/app/admin` admin panel; `actions.ts` holds rounds, extensions, imports, status updates
- `src/lib/entitlements.ts`, `src/lib/rounds.ts` pure rules (quota, pricing, timeline) with tests
- `src/lib/providers/` the OTP/SMS/email and payment hook-in points
