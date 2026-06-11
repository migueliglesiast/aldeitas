# Deploy on Vercel + Neon

Production stack: **[Vercel](https://vercel.com)** (Next.js hosting) + **[Neon](https://neon.tech)** (PostgreSQL).

**Repository:** `migueliglesiast/aldeitas`  
**Root directory in Vercel:** `grupo_hotelero_pxm` (not the monorepo root)

---

## 1. Neon (database)

You may already have a Neon project from local dev. If not:

1. [console.neon.tech](https://console.neon.tech) → **New project** (pick a region close to users, e.g. US East)
2. Open the project → **Connect**
3. Copy **two** connection strings:

| Variable | Neon dashboard option | Host looks like |
|----------|----------------------|-----------------|
| `DATABASE_URL` | **Pooled connection** | `ep-xxx-**pooler**.region.aws.neon.tech` |
| `DIRECT_URL` | **Direct connection** | `ep-xxx.region.aws.neon.tech` (no `pooler`) |

Append `?sslmode=require` if not already in the string.

4. Run schema + seed **once** (from your Mac):

```bash
cd grupo_hotelero_pxm
source ~/.zprofile   # Node 20+

# Paste both URLs into .env first, then:
npx prisma db push
npm run seed
```

> **Local dev tip:** Use Docker Postgres (see `.env.example`) instead of Neon to avoid idle disconnect errors during `npm run dev`.

---

## 2. Vercel (app hosting)

### Create project

1. [vercel.com/new](https://vercel.com/new) → import **GitHub** → `migueliglesiast/aldeitas`
2. **Root Directory:** click *Edit* → set `grupo_hotelero_pxm`
3. **Framework:** Next.js (auto-detected)
4. **Node.js Version:** 20.x (Project Settings → General)

### Build settings

Vercel runs `npm run vercel-build`, which executes:

```bash
prisma db push && prisma generate && next build
```

No custom start command needed — Vercel runs Next.js automatically.

### Environment variables

In Vercel → **Project → Settings → Environment Variables**, add:

| Variable | Value | Environments |
|----------|-------|--------------|
| `DATABASE_URL` | Neon **pooled** URL | Production, Preview, Development |
| `DIRECT_URL` | Neon **direct** URL | Production, Preview, Development |
| `NEXT_PUBLIC_SITE_URL` | `https://your-project.vercel.app` (then your custom domain) | Production |
| `MERCADOPAGO_ACCESS_TOKEN` | `APP_USR-...` | Production |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | `APP_USR-...` | Production |
| `PAYMENT_PROVIDER` | `mercadopago` | Production |
| `BOOKING_RECONCILE_SECRET` | long random string | Production |
| `BOOKING_MIN_CONFIRM_MINUTES` | `15` | Production |
| `BOOKING_MAX_PENDING_MINUTES` | `120` | Production |
| `SMTP_HOST` | e.g. `smtp.resend.com` | Production |
| `SMTP_PORT` | `587` | Production |
| `SMTP_USER` | | Production |
| `SMTP_PASS` | | Production |
| `EMAIL_FROM` | `Aldeitas <bookings@yourdomain.com>` | Production |

**Important:** `NEXT_PUBLIC_SITE_URL` is embedded at **build time**. After changing it, **redeploy**.

Do **not** set `MERCADOPAGO_TEST_PAYER_EMAIL` in production.

`CRON_SECRET` is injected automatically by Vercel when cron jobs are enabled (see below).

### Optional: Vercel + Neon integration

In Vercel → **Storage** → **Connect Neon** can auto-link `DATABASE_URL`. You still need to set `DIRECT_URL` manually for Prisma migrations/push.

---

## 3. Deploy

1. Set env vars (at minimum `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SITE_URL`)
2. **Deploy** (or push to the connected branch)
3. Open the `*.vercel.app` URL — you should see your hotels

If the DB is empty, run `npm run seed` locally against the same Neon `DIRECT_URL`, or recreate data via Admin.

---

## 4. Booking reconcile cron

`vercel.json` schedules reconcile every **10 minutes**:

```json
"path": "/api/bookings/reconcile",
"schedule": "*/10 * * * *"
```

Vercel sends `GET` with `Authorization: Bearer <CRON_SECRET>`. No extra setup if `BOOKING_RECONCILE_SECRET` is set and the project is on a **Pro** plan (Hobby allows cron on one project — check [Vercel cron limits](https://vercel.com/docs/cron-jobs)).

**Fallback (any plan):** use [cron-job.org](https://cron-job.org):

```http
POST https://yourdomain.com/api/bookings/reconcile?secret=YOUR_BOOKING_RECONCILE_SECRET
```

Every 5–10 minutes.

---

## 5. Custom domain

1. Vercel → **Domains** → add `aldeitas.com` (or subdomain)
2. Update DNS per Vercel instructions
3. Set `NEXT_PUBLIC_SITE_URL=https://yourdomain.com`
4. **Redeploy**

---

## 6. Mercado Pago webhook

Mercado Pago → your app → **Webhooks**:

- URL: `https://yourdomain.com/api/mercadopago/webhook`
- Topic: **Orders**

Use **production** keys when going live.

---

## 7. Airbnb calendars

Per room in **Admin → Room edit**:

1. Copy the **`.ics` export URL** → Airbnb → Import calendar
2. Add Airbnb/Guesty **import** calendar URLs on the room for conflict detection

URLs must use your **production domain**, not localhost or ngrok.

---

## 8. Admin image uploads (limitation)

Uploaded images are stored under `public/uploads/` on disk. **Vercel’s filesystem is ephemeral** — uploads may disappear after redeploy.

For production image hosting, plan to move to **Vercel Blob**, **Cloudinary**, or **S3**. Until then, prefer **Airbnb import** or static images under `public/images/hotels/`.

---

## 9. Go-live checklist

- [ ] Neon: `DATABASE_URL` (pooled) + `DIRECT_URL` (direct) in Vercel
- [ ] `NEXT_PUBLIC_SITE_URL` = production HTTPS URL → redeploy
- [ ] Mercado Pago **production** keys
- [ ] `BOOKING_RECONCILE_SECRET` set; cron running (Vercel or external)
- [ ] SMTP + `EMAIL_FROM`
- [ ] MP webhook configured
- [ ] `.ics` export added in Airbnb per room
- [ ] Test: reserve → pay → reconcile → confirmed → email
- [ ] Remove dev-only settings (`BOOKING_MIN_CONFIRM_MINUTES=0`, ngrok URLs)

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails: `DIRECT_URL` | Add both Neon URLs in Vercel env vars |
| `E57P01` connection terminated (local dev) | Neon suspended; refresh or use Docker Postgres locally |
| MP payments fail | Production keys; `NEXT_PUBLIC_SITE_URL` matches deployed domain |
| Bookings stuck Processing | Cron not running; check Vercel cron logs or external cron |
| Airbnb won’t import calendar | URL must end in `.ics` and be public HTTPS |
| Uploads vanish after deploy | Expected on Vercel — use external storage or repo images |

See also [BOOKING_SETUP.md](./BOOKING_SETUP.md).
