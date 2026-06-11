# Booking & payments setup (Mercado Pago)

Direct bookings use **authorize now, capture later** via **Mercado Pago**, then reconcile against iCal calendars (Airbnb / Guesty) before charging the guest.

## 1. Mercado Pago credentials

1. Go to [Mercado Pago Developers](https://www.mercadopago.com.mx/developers/panel/app)
2. Create an application (or use an existing one)
3. Open **Testing → Testing credentials**
4. Copy into `.env`:

```bash
cp .env.example .env

MERCADOPAGO_ACCESS_TOKEN=TEST-...          # Private test access token
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=TEST-... # Public test key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
DATABASE_URL="postgresql://casayahua:casayahua@localhost:5432/casayahua"
```

5. Restart the dev server after changing `.env`

To use **only** Mercado Pago (even if Conekta keys exist elsewhere):

```bash
PAYMENT_PROVIDER=mercadopago
```

## 2. Run locally

```bash
cd grupo_hotelero_pxm
npx prisma db push
npm run dev
```

## 3. Test a booking

1. Open a listing → pick dates → **Reserve** (use **`test@testuser.com`** in sandbox)
2. You are sent to `/booking/[id]/pay` (Mercado Pago card form)
3. Pay with a **Mexico** test card ([official list](https://www.mercadopago.com.mx/developers/en/docs/checkout-api-orders/resources/test-cards)) — e.g. Mastercard `5474 9254 3267 0366`, CVV `123`, expiry `11/30`, cardholder name `APRO`. Do **not** use Brazil/other-region cards like `5031…` (causes `no_payment_method_for_provided_bin`).
4. Status page should show **Processing** (authorized, not captured yet)
5. In another terminal: `npm run reconcile-bookings`

All prices on the site are in **MXN**. Optional sandbox env:

```bash
MERCADOPAGO_TEST_PAYER_EMAIL=test@testuser.com
```

To convert an existing database from USD to MXN (one-time):

```bash
npm run migrate-currency-to-mxn
```

## 4. Webhooks (production / optional local)

Mercado Pago can notify your app when order status changes:

- URL: `https://your-domain.com/api/mercadopago/webhook`
- Topic: **Orders**

For local dev, webhooks are optional — authorization happens when the guest submits the card form on your site.

## 5. Calendar sync (avoid double bookings)

**Import** Airbnb/Guesty calendars into each room (admin or seed).

**Export** your holds to Airbnb — for each listing:

```
https://your-domain.com/api/ical/[listingId]/calendar.ics
```

In Airbnb: Listing → Availability → Import calendar → paste that URL.

Only **authorized PENDING** and **CONFIRMED** bookings block dates.

## How double-booking is prevented

1. **Guest starts checkout** → `PENDING`, no payment yet → does **not** block dates
2. **Card authorized** → `authorizedAt` set → dates blocked + **Hold** in outbound iCal
3. **Reconcile** polls external calendars:
   - Conflict → cancel, release authorization
   - Hold synced + min wait → confirm and **capture**
   - Max wait with no conflict → confirm and capture
4. Unpaid checkouts expire after `BOOKING_MAX_PENDING_MINUTES` (default 120)

```bash
BOOKING_MIN_CONFIRM_MINUTES=15
BOOKING_MAX_PENDING_MINUTES=120
```

## Booking statuses

| Status | Meaning |
|--------|---------|
| PENDING, no `authorizedAt` | Waiting for card payment |
| PENDING, with `authorizedAt` | Authorized; securing dates |
| CONFIRMED | Captured |
| CANCELED | Released, not charged |

## Production checklist

- [ ] Node host (not GitHub Pages)
- [ ] `NEXT_PUBLIC_SITE_URL=https://your-domain.com`
- [ ] Mercado Pago **production** credentials
- [ ] Webhook URL configured
- [ ] iCal export URL added in Airbnb for each room
- [ ] Cron: `POST /api/bookings/reconcile` every 5–10 min with `x-booking-reconcile-secret`

Mercado Pago authorizations must be **captured within 5 days** or they expire.

## Optional: Conekta

Conekta remains supported if you add keys later. With `PAYMENT_PROVIDER=mercadopago` (or no Conekta keys), guests only see Mercado Pago.
