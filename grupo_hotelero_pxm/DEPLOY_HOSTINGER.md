# Deploy on Hostinger + Neon

**App:** Hostinger Node.js Web Apps (Business or Cloud plan)  
**Database:** [Neon](https://neon.tech) PostgreSQL (external — Hostinger does not host Postgres for this app)

**Repo:** `migueliglesiast/aldeitas`  
**Root directory:** `grupo_hotelero_pxm`

---

## Does Hostinger make sense for this app?

**Yes, with caveats** — it is a reasonable Vercel replacement for your case:

| Requirement | Hostinger |
|-------------|-----------|
| Next.js 14 + API routes | Supported on Node.js Web Apps |
| Node 20 | Supported |
| GitHub auto-deploy | Supported |
| Custom domain + SSL | Included |
| MXN / Spanish support | Yes |
| PostgreSQL | Use **Neon** (already set up) |
| Mercado Pago webhooks | Works on your domain |
| Booking reconcile cron | **No built-in cron** → use [cron-job.org](https://cron-job.org) |
| Admin image uploads | Disk may be limited/ephemeral — prefer Airbnb import or cloud storage later |

**You need:** Hostinger **Business Web Hosting** or any **Cloud** plan (Node.js apps are not on basic shared hosting).

**Confirm before buying:** In hPanel, check that you can set **Root directory** to `grupo_hotelero_pxm` (monorepo). If not, see [Monorepo workaround](#monorepo-workaround) below.

---

## 1. Neon (database) — keep as-is

1. [console.neon.tech](https://console.neon.tech) → **Connect**
2. Copy both URLs:

| Variable | Neon option |
|----------|-------------|
| `DATABASE_URL` | **Pooled** (`-pooler` in hostname) |
| `DIRECT_URL` | **Direct** (no `-pooler`) |

Ensure `?sslmode=require` is present.

Schema is already seeded if you ran `npm run seed` locally against this Neon project.

---

## 2. Hostinger — create Node.js app

1. Log in to [hPanel](https://hpanel.hostinger.com)
2. **Websites** → **Add Website** → **Node.js Apps**
3. **Import Git Repository** → authorize GitHub → select `migueliglesiast/aldeitas`
4. Branch: `feature/improving_admin_ux` (or `main` after merge)

### Build settings

| Setting | Value |
|---------|--------|
| **Root directory** | `grupo_hotelero_pxm` |
| **Node.js version** | `20` |
| **Install command** | `npm ci` (or `npm install`) |
| **Build command** | `npm run build` |
| **Start** (automático con Next.js) | Hostinger ejecuta `npm run start -- -p $PORT` → `next start -H 0.0.0.0 -p PORT` |

**Nota:** **Archivo de entrada** solo aparece si el framework es **Otro (Other)**. Con **Next.js** no verás ese campo — no hace falta.

`npm run build` runs `prisma generate && next build` (no DB needed at build time). Sync schema once locally with `npx prisma db push` before first deploy.

### Panel en español — qué sí debes ver en Ajustes y reimplementación

| Campo (puede variar) | Valor correcto |
|----------------------|----------------|
| Framework | **Next.js** (no "Otro") |
| Versión de Node.js | **20.x** |
| Directorio raíz / Root | `grupo_hotelero_pxm` |
| Rama | `feature/improving_admin_ux` |
| Comando de compilación | `npm run build` |

Después de cambiar variables de entorno: **Reimplementar** (no basta con guardar).

### Si runtime logs están vacíos (503)

The Node process is **not starting**. Check in this order:

1. **Variables de entorno** → `DATABASE_URL` must start with `postgresql://` (not `resql://`)
2. **Despliegues** → latest deploy → scroll **past** the route table for `Ready` / `next start` errors
3. **En ejecución** → **Reiniciar** (si aparece al hacer clic en el estado)
4. **Administrador de archivos** → `domains/aldeitas.io/nodejs/` → look for `stderr.log`
5. **Ajustes y reimplementación** → **Reimplementar** after env var fixes

### Environment variables

Add env vars in hPanel **before** the first deploy (or import from a local copy of `.env` **without secrets in git**).

**Important:** set both `DATABASE_URL` and `DIRECT_URL` even though the build no longer hits the database — Prisma validates them when the app starts.

| Variable | Production value |
|----------|------------------|
| `DATABASE_URL` | Neon pooled URL |
| `DIRECT_URL` | Neon direct URL |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com` (no trailing `/`) |
| `MERCADOPAGO_ACCESS_TOKEN` | Production `APP_USR-...` when live |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Production public key |
| `PAYMENT_PROVIDER` | `mercadopago` |
| `BOOKING_RECONCILE_SECRET` | Long random string |
| `BOOKING_MIN_CONFIRM_MINUTES` | `15` |
| `BOOKING_MAX_PENDING_MINUTES` | `120` |
| `NODE_ENV` | `production` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | When ready for email |

Do **not** set `MERCADOPAGO_TEST_PAYER_EMAIL` in production.

5. Click **Deploy** and watch build logs.

---

## 3. Custom domain

1. hPanel → your Node.js site → **Domains**
2. Point DNS to Hostinger (nameservers or A/CNAME they provide)
3. Enable SSL (usually automatic)
4. Update `NEXT_PUBLIC_SITE_URL` to `https://yourdomain.com`
5. **Redeploy** (required — public URL is baked into the client bundle)

---

## 4. Booking reconcile cron (required)

Hostinger managed Node.js does not run cron for you. Use [cron-job.org](https://cron-job.org) (free):

```http
POST https://yourdomain.com/api/bookings/reconcile?secret=YOUR_BOOKING_RECONCILE_SECRET
```

Schedule: every **5–10 minutes**.

---

## 5. Mercado Pago webhook

Mercado Pago → your app → **Webhooks**:

- URL: `https://yourdomain.com/api/mercadopago/webhook`
- Topic: **Orders**

---

## 6. Airbnb calendars

Per room in **Admin → Room edit**:

1. Copy **`.ics` export URL** → Airbnb → Import calendar
2. Add import calendar URLs on the room for conflict detection

Must use your **production HTTPS domain**.

---

## Monorepo workaround

If Hostinger cannot set root directory to `grupo_hotelero_pxm`:

**Option A — Deploy branch:** GitHub Action builds `grupo_hotelero_pxm` and pushes to a `hostinger-deploy` branch with app at repo root (ask to add workflow).

**Option B — Hostinger VPS:** SSH deploy with full control (`cd grupo_hotelero_pxm && npm run build:deploy && npm run start`).

**Option C — Move app** to repo root (larger refactor).

---

## Go-live checklist

- [ ] Business or Cloud plan with Node.js apps
- [ ] Neon `DATABASE_URL` + `DIRECT_URL` in hPanel
- [ ] `NEXT_PUBLIC_SITE_URL` = production HTTPS → redeploy
- [ ] Mercado Pago production keys
- [ ] `BOOKING_RECONCILE_SECRET` + cron-job.org every 5–10 min
- [ ] MP webhook configured
- [ ] Test booking end-to-end
- [ ] Airbnb `.ics` per room

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `package.json not found` | Set root directory to `grupo_hotelero_pxm` |
| **503 Service Unavailable** | App crashed or wrong port — check deployment logs, click **Restart**, fix `DATABASE_URL` (`postgresql://` not `resql://`) |
| **Images not loading (rooms/hotels)** | Room photos in `/uploads/` are not in git — re-import via Admin → Airbnb on production, or run `npx tsx scripts/populate-arbolita-images.ts` against Neon. `next.config.mjs` uses `images.unoptimized: true` for Hostinger. |
| Build fails on Prisma | Set `DATABASE_URL` + `DIRECT_URL` at runtime; run `npx prisma db push` locally once |
| Build fails: TypeScript / tailwind | Ensure install includes devDependencies (`.npmrc` sets `production=false`) |
| App runs but DB empty | Run `npm run seed` locally against Neon `DIRECT_URL` once |
| MP payments fail | Production keys; `NEXT_PUBLIC_SITE_URL` matches live domain |
| Bookings stuck Processing | Cron not hitting reconcile URL |
| `E57P01` locally | Neon idle disconnect — use Docker Postgres for local dev |

See also [BOOKING_SETUP.md](./BOOKING_SETUP.md).
