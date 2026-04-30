-- Per DECISIONS.md D14: Drive integration deferred for V1 step 4.
-- Receipts get parsed in-memory; we store the structured parse result
-- but skip persisting the photo file itself. Drive upload lands later.
ALTER TABLE public.receipts ALTER COLUMN photo_url DROP NOT NULL;
