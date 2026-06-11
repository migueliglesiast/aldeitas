## Casa Yahua – GitHub Pages

This project is configured to export a static build suitable for GitHub Pages.

Deploy flow:
- Push to `main`. GitHub Actions builds and exports to `out/`, then deploys to Pages.
- The workflow sets `NEXT_BASE_PATH` and `NEXT_ASSET_PREFIX` automatically.

Local export:
```bash
export DATABASE_URL="file:./dev.db"
npx prisma db push
npm run seed
npm run export
open out/index.html
```

Limitations on Pages:
- API routes, server actions, payment webhooks, and scraping won’t run on Pages. The static export presents the marketing/catalog UI. Use the app locally or a server for full booking/payment.

## Booking & payments (local / server)

See [BOOKING_SETUP.md](./BOOKING_SETUP.md) for payments and [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md) for production on **Vercel + Neon**.

Quick start (local):

```bash
cp .env.example .env
docker compose up -d
npx prisma db push
npm run seed
# Add MERCADOPAGO_ACCESS_TOKEN and NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY (see BOOKING_SETUP.md)
npm run dev
```

Production deploy: import repo `migueliglesiast/aldeitas` on [Vercel](https://vercel.com/new), set root directory to `grupo_hotelero_pxm`, connect Neon URLs — full steps in [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md).
