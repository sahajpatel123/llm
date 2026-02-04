# White Chat (Foundation)

Minimal single-page chat foundation using Next.js App Router, Postgres, and Prisma.

## Local development

1. Install dependencies

```
npm install
```

2. Start Postgres with Docker

```
docker compose up -d
```

3. Create your local env file

```
cp .env.example .env.local
```

Update `DATABASE_URL` in `.env.local` to match your local database settings.

4. Run migrations

Prisma commands read secrets from `.env.local`; no manual sourcing is needed.

```
npm run db:migrate
```

5. Start the app

```
npm run dev
```

Visit `http://localhost:3000`.

## Database commands

```
npm run db:validate
npm run db:generate
npm run db:migrate
```

## Provider mode (safe defaults)

- Default mode is `mock` for development; no external calls are made.
- To enable live mode, set `PROVIDER_MODE="live"` and fill provider env vars in `.env.local`.

## Billing (safe defaults)

- Default billing mode is `disabled`.
- To enable checkout, set `BILLING_MODE="test"` or `BILLING_MODE="live"` and add keys in `.env.local`.

## Production checklist

Required env vars:
- DATABASE_URL
- SESSION_SECRET
- SESSION_DAYS
- PROVIDER_MODE
- PROVIDER_A_BASE_URL / PROVIDER_A_API_KEY / PROVIDER_A_MODEL (live only)
- PROVIDER_B_BASE_URL / PROVIDER_B_API_KEY / PROVIDER_B_MODEL (live only)
- MAX_OUTPUT_TOKENS_EXPLORATION / MAX_OUTPUT_TOKENS_VERIFIED
- BILLING_MODE / BILLING_KEY_ID / BILLING_KEY_SECRET / BILLING_CURRENCY / SUBSCRIPTION_PERIOD_DAYS (billing only)

PWA install test:
- `npm run build` then `npm run start`
- Open in Chrome and use the Install prompt or the in-app Install button when available.

## Notes

- The UI is a single page at `/` with a minimal layout scaffold.
- All secrets stay in `.env.local`.
