# Learning Log

Running lab notebook: what we built, what the concepts are, why they
matter, where to learn more. The bar: I can explain every file in here
to an interviewer.

---

## Day 1 (2026-08-21): Scaffold + data model

**What we built:** the Next.js project skeleton (via create-next-app)
and the entire database schema in `prisma/schema.prisma`.

**The concepts:**

- **What create-next-app generated:** `src/app/` holds pages (each
  folder = a URL route — that's the "App Router"); `package.json`
  lists dependencies (the libraries npm installed into
  `node_modules/`); `tsconfig.json` configures TypeScript. The dev
  server (`npm run dev`) rebuilds the site live as files change.

- **Schema-first design.** We wrote the data model before any UI,
  because every screen is just a view over these tables. Read the
  schema as sentences: "a User has many Expenses; an Expense may
  belong to a Category and a Group; a Split says who owes what toward
  a shared Expense." Getting these relationships right now is 10x
  cheaper than migrating them later.

- **Money is never a float.** `0.1 + 0.2 != 0.3` in floating point —
  binary fractions can't represent most decimals exactly, and cents
  drift. So `amount` is `Decimal(10,2)`: exact decimal arithmetic in
  the database. (C background makes this intuitive: floats are
  base-2 scientific notation; 0.1 is a repeating fraction in base 2.)

- **Why `categorySource` exists (MANUAL/AI/RULE).** To *measure* the
  AI categorizer later, we must know which labels it produced vs.
  which a human set. Designing for evaluation from day one is the
  difference between "integrated AI" and "can prove the AI works."

- **Why settle-up is an algorithm, not a table.** Who-pays-whom is
  *derived* from the Split rows — storing it would mean keeping two
  copies of the truth in sync (a classic bug factory). Rule: store
  facts, compute conclusions.

- **Prisma 7 detail we hit live:** the DB connection URL no longer
  goes in the schema file — it moved to `prisma.config.ts` and reads
  from the `DATABASE_URL` environment variable. Secrets live in
  `.env` (gitignored), never in committed code.

**Do now:**
1. `npm run dev`, open http://localhost:3000 — the placeholder page.
2. Read `prisma/schema.prisma` top to bottom; for each model, say the
   sentence out loud ("a Budget is a monthly cap for one user in one
   category"). If any relation doesn't make sense, flag it — the
   schema is easiest to change today.
3. Sketch (paper is fine) the dashboard you'd want to see on the 1st
   of the month. That sketch drives what we build in days 2-3.

**Resources:**
- Next.js "App Router" docs, the routing fundamentals page (5 min)
- Prisma "Data model" docs — just the Relations section
- "What Every Programmer Should Know About Floating-Point" (or the
  short version: search 0.30000000000000004)
