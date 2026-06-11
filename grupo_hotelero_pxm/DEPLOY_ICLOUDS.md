# Deploy on iClouds.mx

This app **must** run as a Node.js server (not GitHub Pages static export). Bookings, Mercado Pago, iCal, and admin APIs need server-side routes.

**Repository root for iClouds:** set the project directory to `grupo_hotelero_pxm` (not the monorepo root).

---

## 1. Create accounts

1. [iClouds.mx](https://iclouds.mx) — app hosting  
2. **PostgreSQL** — one of:
   - PostgreSQL add-on in iClouds (if available), or  
   - [Neon](https://neon.tech) free tier (works great; only `DATABASE_URL` lives there)  
3. [Mercado Pago Developers](https://www.mercadopago.com.mx/developers/panel/app) — **production** credentials when you go live  

---

## 2. Database (PostgreSQL)

### Option A — Neon (recommended if iClouds has no Postgres)

**Use the website** (no CLI required):

1. Create a project at [console.neon.tech](https://console.neon.tech)  
2. Open your project → **Connect** → copy the **PostgreSQL** connection string  
3. Paste as `DATABASE_URL` in iClouds env vars  

> **Note:** `npx neonctl init` needs **Node.js 20+** (22+ for latest neonctl). If you see  
> `addAbortListener` errors, upgrade Node or skip the CLI and use the dashboard above.

### Option B — iClouds database

If iClouds offers PostgreSQL, create a database and use the connection string they provide.

### Local development

```bash
cd grupo_hotelero_pxm
docker compose up -d
cp .env.example .env
# DATABASE_URL is already set for local Postgres in .env.example
npx prisma db push
npm run seed
npm run dev
```

---

## 3. Connect GitHub to iClouds

1. Log in to iClouds → **New project**  
2. Import your GitHub repo  
3. **Root directory:** `grupo_hotelero_pxm`  
4. Framework: should auto-detect **Next.js**  

### Build command

```bash
npx prisma db push && npm run build
```

### Start command

```bash
npm run start
```

iClouds sets `PORT` automatically; the app listens on `0.0.0.0`.

### Node version

Use **Node 20** if the dashboard asks.

---

## 4. Environment variables (iClouds dashboard)

Set these **before the first deploy** (especially `NEXT_PUBLIC_SITE_URL` — it is baked in at build time).

| Variable | Example | Notes |
|----------|---------|--------|
| `DATABASE_URL` | `postgresql://...` | From Neon or iClouds Postgres |
| `NEXT_PUBLIC_SITE_URL` | `https://aldeitas.com` | Your real domain, no trailing `/` |
| `MERCADOPAGO_ACCESS_TOKEN` | `APP_USR-...` | Production token when live |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | `APP_USR-...` | Production public key |
| `PAYMENT_PROVIDER` | `mercadopago` | |
| `BOOKING_RECONCILE_SECRET` | long random string | For cron |
| `BOOKING_MIN_CONFIRM_MINUTES` | `15` | |
| `BOOKING_MAX_PENDING_MINUTES` | `120` | |
| `SMTP_HOST` | `smtp.resend.com` | See email section |
| `SMTP_PORT` | `587` | |
| `SMTP_USER` | | |
| `SMTP_PASS` | | |
| `EMAIL_FROM` | `Aldeitas <bookings@yourdomain.com>` | |
| `NODE_ENV` | `production` | |

Do **not** set `MERCADOPAGO_TEST_PAYER_EMAIL` in production.

---

## 5. Custom domain

1. In iClouds, add your domain (e.g. `aldeitas.com` or `bookings.aldeitas.com`)  
2. Point DNS to iClouds (they will show A/CNAME records)  
3. Wait for SSL  
4. Update `NEXT_PUBLIC_SITE_URL` to `https://yourdomain.com`  
5. **Redeploy** so the public URL is embedded in the client bundle  

---

## 6. Seed production data (once)

After the first successful deploy, run seed **once** via iClouds shell/one-off job if available:

```bash
npx prisma db push
npm run seed
```

Or recreate hotels/rooms through **Admin** and import from Airbnb per room.

---

## 7. Reconcile cron (required)

Bookings stay “Processing” until reconcile runs. Schedule every **5–10 minutes**:

```http
POST https://yourdomain.com/api/bookings/reconcile?secret=YOUR_BOOKING_RECONCILE_SECRET
```

Free options: [cron-job.org](https://cron-job.org), [EasyCron](https://www.easycron.com).

---

## 8. Mercado Pago webhook (recommended)

In Mercado Pago → your app → Webhooks:

- URL: `https://yourdomain.com/api/mercadopago/webhook`  
- Topic: **Orders**  

---

## 9. Airbnb calendars

For **each room** in Admin → Room edit:

1. Copy the **`.ics` export URL** → paste in Airbnb → Import calendar  
2. Ensure Airbnb/Guesty **import** calendars are configured on the room (for conflict detection)  

URLs must use your **production domain**, not ngrok or localhost.

---

## 10. Email

Until SMTP is configured, emails only appear in server logs. For production use e.g. [Resend](https://resend.com), SendGrid, or your domain host’s SMTP.

Test after deploy: complete a booking and check logs or inbox.

---

## 11. Go-live checklist

- [ ] PostgreSQL connected (`DATABASE_URL`)  
- [ ] `NEXT_PUBLIC_SITE_URL` = production HTTPS URL  
- [ ] Mercado Pago **production** keys  
- [ ] `BOOKING_RECONCILE_SECRET` + cron every 5–10 min  
- [ ] SMTP + `EMAIL_FROM`  
- [ ] MP webhook configured  
- [ ] `.ics` export added in Airbnb for each room  
- [ ] Test booking: reserve → pay → reconcile → confirmed → email  
- [ ] Remove dev settings (`BOOKING_MIN_CONFIRM_MINUTES=0`, ngrok URL)  

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails on Prisma | Ensure `DATABASE_URL` is set **before** build; build runs `prisma db push` |
| MP payments fail | Check production keys; `NEXT_PUBLIC_SITE_URL` must match deployed domain |
| Bookings stuck Processing | Cron not running; check `BOOKING_RECONCILE_SECRET` |
| Airbnb won’t import calendar | URL must end in `.ics` and be publicly reachable |
| Emails not sent | Set `SMTP_*` and `EMAIL_FROM`; check spam |

See also [BOOKING_SETUP.md](./BOOKING_SETUP.md).
