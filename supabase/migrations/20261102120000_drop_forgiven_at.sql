-- Forgiving a loan now closes it and records the rest as an expense/income on
-- the loan's date (see 20261102110000_writeoff_records.sql), so the separate
-- forgiven_at flag is no longer used. Safe whether or not it was ever added.
ALTER TABLE debts    DROP COLUMN IF EXISTS forgiven_at;
ALTER TABLE lendings DROP COLUMN IF EXISTS forgiven_at;
