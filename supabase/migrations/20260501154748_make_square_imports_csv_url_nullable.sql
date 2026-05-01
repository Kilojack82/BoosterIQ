-- Same Drive-deferred pattern as DECISIONS.md D14: we parse Square
-- reports in-memory and store the structured result; we don't persist
-- the source file (CSV or PDF) anywhere yet. Drive integration lands
-- alongside the master-sheet Drive flow.
ALTER TABLE public.square_imports ALTER COLUMN csv_url DROP NOT NULL;
