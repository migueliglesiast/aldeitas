# aldeitas-web

Next.js 16 (App Router) + React 19 booking platform. Casa Yahua's suites are served here like
every other hotel (the former `apps/yahua-static` generator has been removed).

## Local development

```bash
export DATABASE_URL="file:./dev.db"
npx prisma db push
npm run seed
npm run dev
```

## Testing

```bash
npm test                    # Vitest unit + API + accessibility (axe) tests
npm run test:coverage       # with coverage; fails below the thresholds in vitest.config.mts
npm run e2e                 # Playwright on chromium, firefox and webkit
npm run e2e -- --project=chromium   # single browser
```

Playwright uses a dedicated SQLite database (`file:./e2e.db`) that is reset and seeded on every
run; it never touches development data.

## Deployment (Vercel + Postgres)

The app deploys to Vercel through the Git integration. Production uses Postgres via
`prisma/schema.postgres.prisma`:

- Set `PRISMA_SCHEMA=prisma/schema.postgres.prisma` so `postinstall` generates the Postgres client.
- Point `DATABASE_URL` at the Postgres instance.
- Push the schema with `npm run db:push:postgres`.

SQLite remains the database for development, unit tests and E2E runs.
