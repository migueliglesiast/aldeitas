# Hotel storefront domains

Each hotel can have its own **custom domain** (e.g. `aldeitamixteca.com`) that shows a branded storefront for that hotel only. The same Next.js app, database, bookings, payments, and admin power every domain.

| Domain | Role |
|--------|------|
| `aldeitas.io` | Portal — all hotels |
| `aldeitamixteca.com` | Storefront — Aldeita Mixteca only |

---

## Assign a GoDaddy domain to Aldeita Mixteca

### 1. Set the domain in admin (or database)

**Admin:** `aldeitas.io/admin` → Aldeita Mixteca → **General Info** → **Storefront domain** → `aldeitamixteca.com` → Save.

Or run once against Neon:

```bash
cd grupo_hotelero_pxm
npx tsx scripts/backfill-hotel-storefronts.ts
```

### 2. Point GoDaddy DNS to Hostinger

In **GoDaddy** → your domain → **DNS**:

**Option A — CNAME (preferred if GoDaddy allows it on `@`):**

| Type | Name | Value | TTL |
|------|------|--------|-----|
| CNAME | `www` | `aldeitas.io` | 1 hour |
| CNAME or Forward | `@` | `aldeitas.io` | 1 hour |

**Option B — A record (if `@` cannot be a CNAME):**

1. In **Hostinger hPanel** → Websites → `aldeitas.io` → note the **IP address** used for the site.
2. In GoDaddy:

| Type | Name | Value | TTL |
|------|------|--------|-----|
| A | `@` | *(Hostinger IP)* | 1 hour |
| CNAME | `www` | `aldeitas.io` | 1 hour |

DNS can take up to 24–48 hours to propagate (often much faster).

### 3. Add the domain in Hostinger

1. **hPanel** → your Node.js site (`aldeitas.io`)
2. **Domains** → **Add domain** (or **Connect domain**)
3. Enter `aldeitamixteca.com` and `www.aldeitamixteca.com`
4. Enable **SSL** (usually automatic after DNS resolves)

The new domain must point to the **same Node.js app** as `aldeitas.io` — not a separate empty site.

### 4. Environment variables (hPanel)

Add storefront domains to allowed origins (then **Reimplementar**):

```env
STOREFRONT_ALLOWED_ORIGINS=aldeitamixteca.com,www.aldeitamixteca.com
```

`NEXT_PUBLIC_SITE_URL` stays `https://aldeitas.io` (portal URL).

### 5. Deploy latest code

Redeploy from branch `feature/improving_admin_ux` so middleware + storefront layout are live.

### 6. Verify

- https://aldeitamixteca.com → Aldeita Mixteca homepage (hotel logo header, rooms, search)
- https://aldeitamixteca.com/listing/... → room booking works
- https://aldeitamixteca.com/admin → redirects to `https://aldeitas.io/admin`
- https://aldeitas.io → still shows all hotels

---

## Local testing (before DNS)

Add to `/etc/hosts`:

```
127.0.0.1 aldeitamixteca.local
```

In admin, set storefront domain to `aldeitamixteca.local`, then open http://aldeitamixteca.local:3000

---

## Add another hotel later

1. Buy/connect domain in GoDaddy
2. Admin → hotel → **Storefront domain** → save
3. Hostinger → add domain to same app
4. Add domain to `STOREFRONT_ALLOWED_ORIGINS` → redeploy

No separate deploy per hotel.
