# Aldeitas monorepo

npm workspaces monorepo with one application:

| Workspace | Package | Stack |
| --- | --- | --- |
| `apps/web` | `aldeitas-web` | Next.js 16 (App Router) + React 19, Prisma, Stripe |

Casa Yahua's suites (photos, iCal availability) are served through `apps/web` like every other
hotel. The former `apps/yahua-static` static-site generator has been removed; its content now
lives in `apps/web`.

## Databases

- **Development, unit tests and E2E**: SQLite via Prisma (`DATABASE_URL=file:./dev.db` for dev,
  `file:./e2e.db` for Playwright — the E2E web server resets and seeds it on every run).
- **Production (Vercel)**: Postgres via `apps/web/prisma/schema.postgres.prisma`. Run
  `npm run generate:postgres` in the build step to generate the Postgres client,
  and point `DATABASE_URL` at the Postgres instance. `npm run db:push:postgres` pushes the schema.

## Getting started

```bash
npm ci                      # installs every workspace
npm run build               # builds apps/web
npm run lint                # lints every workspace
npm test                    # unit tests (Vitest)
npm run test:coverage       # unit tests + coverage/lcov.info per app
npm run e2e                 # Playwright E2E for apps/web
```

`apps/web` needs a `.env` with at least `DATABASE_URL` (e.g. `file:./dev.db`).
Optional: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL`.

## Testing

- **Unit tests**: Vitest. `apps/web` runs in `jsdom` with Testing Library. Coverage uses the V8
  provider with `all: true`, so files without tests are reported too. Reports land in
  `apps/web/coverage/lcov.info`. Coverage thresholds are enforced in
  `apps/web/vitest.config.mts` (statements/lines 95%, branches 89%, functions 85%) —
  `npm run test:coverage` fails when coverage drops below them.
- **Accessibility**: axe-core checks (via `jest-axe`) run as part of the unit suite
  (`apps/web/tests/a11y`), asserting the key forms and auth pages render without axe violations.
- **E2E**: Playwright (`apps/web/playwright.config.ts`) across **chromium, firefox and webkit**
  (to run a single browser, run `npm run e2e -- --project=chromium` from `apps/web`). The web
  server step resets a dedicated SQLite database (`file:./e2e.db`), seeds it via `apps/web/e2e/seed.ts` and runs
  `next build && next start`.
  Stripe is intentionally unconfigured so bookings stop at `PENDING` instead of redirecting to Checkout.

## Outbound request allowlist

Server-side iCal fetches and listing scraping only accept `https` URLs on `airbnb.com`,
`guesty.com` and `booking.com` (subdomains included); private, loopback and metadata addresses are
rejected. Redirects are followed manually and every hop is revalidated.

Add other calendar providers with the `ICAL_ALLOWED_HOSTS` environment variable (comma separated
domains, subdomains included):

```bash
ICAL_ALLOWED_HOSTS=lodgify.com,hostaway.com
```

Calendars on a host that is not allowed cannot be fetched, and `POST /api/book` fails closed with
`503` rather than accepting a reservation it cannot verify.

## Security scanning

### Semgrep

CI runs `semgrep scan` with `p/javascript`, `p/typescript`, `p/react`, `p/nodejs` and
`p/owasp-top-ten`, and fails on any finding. Run it locally with:

```bash
semgrep scan --config p/javascript --config p/typescript --config p/react \
           --config p/nodejs --config p/owasp-top-ten --error
```

### Static analysis (no account required)

Instead of SonarCloud (which needs a SonarQube Cloud account), the quality gate is enforced with
fully local, free tooling:

- **SonarJS rules** through [`eslint-plugin-sonarjs`](https://github.com/SonarSource/eslint-plugin-sonarjs) —
  the same bug/code-smell rules the SonarQube JS/TS analyzer ships, run by ESLint.
- **[`eslint-plugin-security`](https://github.com/eslint-community/eslint-plugin-security)** for
  injection/unsafe-API detection.
- **`tsc --noEmit`** as a type-level gate for `apps/web`.
- **`npm audit`** for dependency advisories.

```bash
npm run lint                      # sonarjs + security + next/core-web-vitals
npm --workspace apps/web exec tsc -- --noEmit
npm audit
```

CI fails on any ESLint error, any type error, any Semgrep finding and any **critical** advisory.


If a SonarQube Cloud account becomes available later, this repository can be imported there without
code changes — `apps/web` already emits `coverage/lcov.info`.

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push to `main` and every PR:

1. `test` — `npm ci`, `npm run lint`, `npm run test:coverage` (fails below the coverage
   thresholds), uploads `apps/web/coverage/lcov.info`.
2. `e2e` — Playwright against a freshly seeded SQLite database, in a matrix across chromium,
   firefox and webkit.
3. `semgrep` — the rulesets above, failing on any finding.
4. `static-analysis` — type check plus dependency audit (the SonarJS/security ESLint rules run in `test`).

## Deployment

`apps/web` deploys to Vercel through Vercel's Git integration; there is no deploy workflow in this
repository. Production uses Postgres (see [Databases](#databases)); SQLite remains the database
for local development, unit tests and E2E runs.
