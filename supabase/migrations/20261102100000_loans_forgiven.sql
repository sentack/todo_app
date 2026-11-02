-- "Forgiven": you don't expect the rest back (or to pay it), so it's left out
-- of totals — but the loan stays on record and later payments are still
-- recorded as usual. NULL = not forgiven.
ALTER TABLE debts    ADD COLUMN IF NOT EXISTS forgiven_at timestamptz;
ALTER TABLE lendings ADD COLUMN IF NOT EXISTS forgiven_at timestamptz;
