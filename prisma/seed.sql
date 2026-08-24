-- Default categories, available to every user (userId NULL = built-in).
-- Raw SQL on purpose: know the layer under Prisma.
--
-- Two things worth knowing here:
-- 1. Fixed ids, not generated ones: Prisma's cuid() default is created
--    by the *client library*, not the database — raw SQL inserts must
--    supply ids themselves. Stable ids also make seeds idempotent.
-- 2. ON CONFLICT (id) DO NOTHING makes rerunning this file safe.
--    (Note: the (name, userId) unique index does NOT stop duplicate
--    NULL-userId rows — Postgres treats NULLs as distinct in unique
--    indexes. The fixed id is what actually protects us here.)

INSERT INTO "Category" (id, name, emoji, "userId") VALUES
  ('cat_food',          'Food',          '🍜', NULL),
  ('cat_delivery',      'Delivery',      '🛵', NULL),
  ('cat_transport',     'Transport',     '🚗', NULL),
  ('cat_gas',           'Gas',           '⛽', NULL),
  ('cat_rent',          'Rent',          '🏠', NULL),
  ('cat_subscriptions', 'Subscriptions', '📺', NULL),
  ('cat_fun',           'Fun',           '🎉', NULL),
  ('cat_misc',          'Misc',          '📦', NULL)
ON CONFLICT (id) DO NOTHING;
