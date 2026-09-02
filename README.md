# tally

Budget tracking + bill splitting in one app. Set monthly caps per
category (food, delivery, transport, rent...), log expenses or import a
bank CSV, split shared costs with your group, and settle up with the
fewest possible payments. An LLM categorizes expenses and turns your
numbers into a readable monthly plan — the math is always code; the AI
only writes the words.

Building it because I want to track my own budget with it. Splitwise meets a budget
app, simple enough to actually use as a college student.

## Stack

Next.js (App Router) · TypeScript · React · Tailwind · Prisma ·
Postgres. Deploy (plan): Vercel. AI: Claude API for categorization + plan
narration, with a measured accuracy eval.

## Status

Working locally: you can add expenses, set monthly caps per category,
and see spend-against-cap bars for the current month.

- [x] Next.js scaffold, Prisma schema (User/Expense/Category/Budget/Group/Split)
- [x] Local Postgres + first migration + seeded categories
- [x] Expense entry, recent list, dashboard with category cap bars
- [ ] CSV import
- [ ] AI categorization + merchant-memory fallback + accuracy eval
- [ ] Groups, splitting, settle-up minimization algorithm
- [ ] Monthly plan suggestions + digest
- [ ] Auth, deploy, CI

## Develop

```bash
npm install
createdb tally_dev                  # local Postgres
echo 'DATABASE_URL="postgresql://localhost:5432/tally_dev"' > .env
npx prisma migrate dev              # create the tables
psql -d tally_dev -f prisma/seed.sql  # seed the default categories
npm run dev                         # http://localhost:3000
```

`docs/LEARNING.md` is the running lab notebook — what each piece does,
why it is built that way, and the bugs hit along the way.

## Design notes

- **Money is `Decimal`, never `float`.** Amounts travel as strings from
  the form into Postgres so they never pass through a JS float.
- **Category totals are aggregated in the database** (`groupBy` +
  `_sum`), not summed in JavaScript — one round-trip, exact arithmetic.
- **Every expense records how it was categorized** (`MANUAL` / `AI` /
  `RULE`), so when LLM categorization lands its accuracy is measurable
  against human labels rather than assumed.
- **Settle-up is computed, not stored.** Who-owes-whom is derived from
  the split rows, so there is never a second copy of the truth to drift.

## Not covered (on purpose)

Native mobile apps (responsive web first), bank-account linking/Plaid
(CSV import instead — no credentials handling), and multi-currency.
