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
- API routes, server actions, Stripe webhooks, and scraping won’t run on Pages. The static export presents the marketing/catalog UI. Use the app locally or a server for full booking/payment.


