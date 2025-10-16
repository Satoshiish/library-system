# Library Inventory (Library Management) - Next.js + Supabase

This is a library inventory / management application built with Next.js (App Router) and Supabase as the backend. The app includes books, borrowers, and transaction tracking features. This README explains how to install dependencies, configure environment variables, set up the database (SQL scripts included in `scripts/`), and run the app on Windows (PowerShell).

## Prerequisites

- Node.js 18 or newer (recommended LTS). Verify with `node -v`.
- pnpm (the project lockfile is `pnpm-lock.yaml`) — you can use npm or yarn but commands below use pnpm. If pnpm is not installed you can enable it via corepack:

  In PowerShell (Windows):

  ```powershell
  corepack enable; corepack prepare pnpm@latest --activate
  ```

- A Supabase project (or a PostgreSQL database). You'll need the Supabase URL and anon/public key for client access. See `lib/supabaseClient.ts` for usage.
- (Optional) psql (Postgres command-line) if you want to run the SQL scripts locally.

## Installing dependencies

Open PowerShell in the repository root and run:

```powershell
pnpm install
```

The core dependencies (as taken from `package.json`) are:

- next ^14.2.33
- react ^18
- react-dom ^18
- @supabase/supabase-js ^2.58.0
- @supabase/ssr (latest)
- @vercel/analytics 1.3.1
- tailwindcss ^4.1.9
- autoprefixer ^10.4.20
- postcss ^8.5
- typescript ^5
- react-hook-form ^7.60.0
- zod 3.25.67
- date-fns 4.1.0
- recharts 2.15.4
- sonner ^1.7.4
- lucide-react ^0.454.0
- class-variance-authority ^0.7.1
- clsx ^2.1.1

Plus a set of Radix UI packages used by UI components (examples):

- @radix-ui/react-accordion
- @radix-ui/react-alert-dialog
- @radix-ui/react-avatar
- @radix-ui/react-checkbox
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-popover
- @radix-ui/react-toast
- @radix-ui/react-tooltip

Dev dependencies include Tailwind PostCSS plugin and types:

- tailwindcss-animate ^1.0.7
- @tailwindcss/postcss ^4.1.9
- tailwindcss ^4.1.9
- typescript ^5
- @types/node ^22
- @types/react ^18
- @types/react-dom ^18

Note: The project uses the `pnpm-lock.yaml` included in the repo; running `pnpm install` will install the exact versions.

## Environment variables

Create a `.env.local` file in the project root with the following variables (example):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon-key

# Optional: if server-side secret usage is added, use NEXT_PUBLIC_ prefix only for public anon keys
# For private server keys use: SUPABASE_SERVICE_ROLE_KEY (not shown in this repo)
```

The Supabase client in `lib/supabaseClient.ts` reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Database setup

Two SQL scripts are provided in the `scripts/` directory:

- `scripts/create-library-schema.sql` — creates tables, triggers, and indexes.
- `scripts/seed-library-data.sql` — inserts sample users, books, borrowers, and borrower_records.

You can apply these scripts in one of two common ways:

1) Using the Supabase SQL editor (recommended for Supabase-hosted DB)

   - Open your Supabase project dashboard.
   - Navigate to SQL -> New query.
   - Copy & paste the contents of `scripts/create-library-schema.sql` and run it.
   - Then copy & paste `scripts/seed-library-data.sql` and run it to insert sample data.

2) Using psql (local Postgres or connection to Supabase DB)

   Example PowerShell commands (replace placeholders with your connection info):

   ```powershell
   # If you have a DATABASE_URL or connection string
   psql "postgresql://user:password@host:5432/database" -f .\scripts\create-library-schema.sql
   psql "postgresql://user:password@host:5432/database" -f .\scripts\seed-library-data.sql
   ```

   Note: For Supabase, you can find the DB connection string in Project -> Settings -> Database -> Connection Info. Be careful with service-role keys; do not expose them to the browser.

## Running the app (development)

Start the dev server (PowerShell):

```powershell
pnpm dev
```

This runs `next dev` and serves the app at http://localhost:3000 by default.

Build for production and preview:

```powershell
pnpm build
pnpm start
```

## Linting

Run the linter (if configured):

```powershell
pnpm lint
```

## Files of interest

- `app/` — Next.js App Router pages and routes.
- `lib/supabaseClient.ts` — Supabase client initialization (reads env vars).
- `scripts/create-library-schema.sql` and `scripts/seed-library-data.sql` — DB schema and seed data.
- `components/` — UI components used across the app.
- `types/library.ts` — Type definitions used in the app.

## Troubleshooting

- If you see errors about missing environment variables, verify `.env.local` exists and that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are defined.
- If pnpm is not available, enable corepack as shown in the Prerequisites section, or use npm/yarn and run `npm install` / `yarn` then `npm run dev`.
- If you get database errors when running SQL scripts on Supabase, ensure your DB user has permission to create extensions (some managed Supabase plans restrict extension creation). If `uuid-ossp` cannot be created, remove the extension line and manually provide UUID values or check allowed extensions in your project.

## Notes and security

- The repo includes sample hashed passwords in `scripts/seed-library-data.sql`; those are for local/testing only. Use secure password handling (bcrypt) and do not include plaintext secrets.
- Public keys (NEXT_PUBLIC_*) are safe to expose to the browser. Never commit server-only secrets.

## Contact / Next steps

If you want, I can:

- Add a short CONTRIBUTING or DEVELOPMENT.md with debug tips.
- Add a Dockerfile and docker-compose for local development with Postgres.
- Add a GitHub Actions workflow to run lint and build on push.

Happy hacking!
