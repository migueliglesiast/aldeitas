# Aldeitas monorepo

npm workspaces monorepo with two applications:

| Workspace | Package | Stack |
| --- | --- | --- |
| `apps/web` | `aldeitas-web` | Next.js 14 (App Router), Prisma + SQLite, Stripe |
| `apps/yahua-static` | `aldeitas-yahua-static` | Vanilla Node static site generator (Casa Yahua) |

## Getting started

```bash
npm ci                      # installs every workspace
npm run build               # builds both apps
npm run lint                # lints every workspace
npm test                    # unit tests (Vitest) in both workspaces
npm run test:coverage       # unit tests + coverage/lcov.info per app
npm run e2e                 # Playwright E2E for apps/web
```

`apps/web` needs a `.env` with at least `DATABASE_URL` (e.g. `file:./dev.db`).
Optional: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL`.

## Testing

- **Unit tests**: Vitest. `apps/web` runs in `jsdom` with Testing Library; `apps/yahua-static`
  runs in `node`. Coverage uses the V8 provider with `all: true`, so files without tests are
  reported too. Reports land in `<app>/coverage/lcov.info`.
- **E2E**: Playwright (`apps/web/playwright.config.ts`). The web server step resets a dedicated
  SQLite database (`file:./e2e.db`), seeds it via `apps/web/e2e/seed.ts` and runs `next build && next start`.
  Stripe is intentionally unconfigured so bookings stop at `PENDING` instead of redirecting to Checkout.

## Security scanning

### Semgrep

CI runs `semgrep ci` with `p/javascript`, `p/typescript`, `p/react`, `p/nodejs` and
`p/owasp-top-ten`, and fails on any finding. Run it locally with:

```bash
semgrep ci --config p/javascript --config p/typescript --config p/react \
           --config p/nodejs --config p/owasp-top-ten --error
```

### SonarCloud (free tier)

1. Sign in at <https://sonarcloud.io> with GitHub and import the `antoniolruiz/aldeitas` repository
   into your SonarCloud organization (free for public repositories).
2. Choose **With GitHub Actions** as the analysis method — SonarCloud will show a `SONAR_TOKEN`.
3. In GitHub, add it under **Settings → Secrets and variables → Actions → New repository secret**
   with the name `SONAR_TOKEN`.
4. Confirm that `sonar.organization` and `sonar.projectKey` in [`sonar-project.properties`](./sonar-project.properties)
   match the values SonarCloud shows for the project.
5. Disable **Automatic Analysis** in *Administration → Analysis Method* so the CI-based analysis is used.
6. First scan over the whole codebase: in *Administration → New Code*, pick a baseline
   (e.g. "Previous version" with a version older than the current one, or a specific analysis date)
   so the **Sonar way** Quality Gate is evaluated over **Overall Code** for this first pass. After the
   baseline scan is green you can switch New Code back to "Previous version" for incremental analysis.

The CI job fails when the Quality Gate fails. The target is rating **A** in Reliability, Security and
Maintainability, and **0 vulnerabilities of medium severity or higher**.

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push to `main` and every PR:

1. `test` — `npm ci`, `npm run lint`, `npm run test:coverage`, uploads both `lcov.info` files.
2. `e2e` — Playwright against a freshly seeded SQLite database.
3. `semgrep` — the rulesets above, failing on any finding.
4. `sonarcloud` — regenerates coverage, runs the scanner and enforces the Quality Gate.

[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) builds and publishes the
static site.
