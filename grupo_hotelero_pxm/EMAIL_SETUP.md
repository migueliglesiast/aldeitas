# Email setup (SMTP)

Booking emails are sent automatically at three points:

| Event | Guest email | Admin email |
|-------|-------------|-------------|
| Payment authorized (processing) | Yes | Yes |
| Booking confirmed | Yes | Yes |
| Booking canceled | Yes | Yes |

If SMTP is **not** configured, emails are **logged to the server console** instead of sent. Bookings still work.

---

## 1. Choose a sender address

Use a real mailbox you control on your domain, for example:

- `noreply@aldeitas.io`
- `reservas@aldeitas.io`

Guests can reply to `EMAIL_REPLY_TO` if you set one (e.g. `reservas@aldeitas.io`).

---

## 2. Hostinger mailbox (recommended if domain is on Hostinger)

1. hPanel → **Emails** → create `noreply@aldeitas.io` (or use an existing mailbox)
2. Note the mailbox password
3. Add to `.env` locally and **hPanel environment variables** on production:

```bash
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@aldeitas.io
SMTP_PASS=your-mailbox-password
EMAIL_FROM="Aldeitas <noreply@aldeitas.io>"
EMAIL_REPLY_TO=reservas@aldeitas.io
NEXT_PUBLIC_SITE_URL=https://aldeitas.io
```

4. **Redeploy** after changing env vars on Hostinger

Hostinger also supports port **587** with `SMTP_SECURE=false`.

---

## 3. Other providers

| Provider | SMTP host | Port | Notes |
|----------|-----------|------|-------|
| **Gmail** (App Password) | `smtp.gmail.com` | 587 | Use [App Password](https://myaccount.google.com/apppasswords), not your main password |
| **SendGrid** | `smtp.sendgrid.net` | 587 | User: `apikey`, Pass: your API key |
| **Resend** | `smtp.resend.com` | 587 | User: `resend`, Pass: API key |
| **Zoho Mail** | `smtp.zoho.com` | 587 | Full email as user |

---

## 4. Staff notifications

By default, admin copies go to the **hotel owner** and **hotel managers** linked in the database.

Override with a fixed inbox (comma-separated):

```bash
BOOKING_NOTIFY_EMAIL=reservas@aldeitas.io,manager@example.com
```

Link admins to hotels:

```bash
npm run admin:link -- --email you@example.com --hotel "La Arbolita"
```

---

## 5. Test locally

```bash
cd grupo_hotelero_pxm
cp .env.example .env   # if needed — then fill SMTP_* values
npm run email:test -- --to your@email.com
```

You should see:

1. `SMTP connection verified.`
2. `Test email sent to ...`

Then run a test booking and authorize payment — you should receive the **processing** email.

---

## 6. Production checklist

- [ ] `SMTP_*` and `EMAIL_FROM` set in **hPanel** (not only local `.env`)
- [ ] `NEXT_PUBLIC_SITE_URL=https://aldeitas.io` in hPanel → **redeploy**
- [ ] `npm run email:test` works locally with the same credentials
- [ ] `BOOKING_NOTIFY_EMAIL` or hotel owner/managers configured
- [ ] Test booking on production receives guest + admin emails

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Emails only in server logs | SMTP env vars missing or `EMAIL_FROM` not set |
| `SMTP verification failed` | Wrong host/port/password; try 465 + `SMTP_SECURE=true` |
| Emails go to spam | Use a domain mailbox (not Gmail free); add SPF/DKIM in DNS (hPanel → Emails → DNS records) |
| Links in email point to localhost | Set `NEXT_PUBLIC_SITE_URL` to production URL and redeploy |
| Admin emails missing | Set `BOOKING_NOTIFY_EMAIL` or run `npm run admin:link` |

See also [BOOKING_SETUP.md](./BOOKING_SETUP.md) and [DEPLOY_HOSTINGER.md](./DEPLOY_HOSTINGER.md).
