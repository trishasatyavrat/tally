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

Day 1 — scaffold + data model. Roadmap:

- [x] Next.js scaffold, Prisma schema (User/Expense/Category/Budget/Group/Split)
- [ ] Local Postgres + first migration + seed categories
- [ ] Expense entry, list, dashboard with category cap bars
- [ ] CSV import
- [ ] AI categorization + merchant-memory fallback + accuracy eval
- [ ] Groups, splitting, settle-up minimization algorithm
- [ ] Monthly plan suggestions + digest
- [ ] Auth, deploy, CI

## Develop

```bash
npm install
npm run dev
```

Needs a `DATABASE_URL` in `.env` (Postgres) — see `prisma/schema.prisma`
for the data model. `docs/LEARNING.md` is the running lab notebook.

## Not covered (on purpose)

Native mobile apps (responsive web first), bank-account linking/Plaid
(CSV import instead — no credentials handling), and multi-currency.
