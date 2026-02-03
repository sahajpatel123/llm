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

## Notes

- The UI is a single page at `/` with a minimal layout scaffold.
- All secrets stay in `.env.local`.
