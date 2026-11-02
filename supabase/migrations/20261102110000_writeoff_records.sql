-- Old write-offs closed a loan and recorded the unpaid part as an expense
-- (lending, "Written off: loan to …") or income (debt, "Forgiven: debt to …")
-- dated the day of the write-off. This:
--   1. links each write-off entry in paid_history to that row (record_id), so
--      the app can reopen the loan or shrink the record when money comes back
--   2. moves the record to the loan's own date — when the money actually left
--      (or arrived)
-- Matching is by user, description, amount and the write-off date. A record
-- edited since then won't match; it is left as is with record_id null.

UPDATE lendings l
SET paid_history = (
  SELECT jsonb_agg(
    CASE WHEN (p->>'written_off')::boolean IS TRUE AND p->>'record_id' IS NULL THEN
      p || jsonb_build_object('record_id', (
        SELECT e.id FROM expenses e
        WHERE e.user_id = l.user_id
          AND e.description = 'Written off: loan to ' || l.person
          AND e.amount = round((p->>'amount')::numeric, 2)
          AND e.date = (p->>'date')::date
        ORDER BY e.created_at LIMIT 1))
    ELSE p END
    ORDER BY t.ord)
  FROM jsonb_array_elements(l.paid_history) WITH ORDINALITY AS t(p, ord)
)
WHERE l.paid_history @> '[{"written_off": true}]';

UPDATE debts d
SET paid_history = (
  SELECT jsonb_agg(
    CASE WHEN (p->>'written_off')::boolean IS TRUE AND p->>'record_id' IS NULL THEN
      p || jsonb_build_object('record_id', (
        SELECT i.id FROM incomes i
        WHERE i.user_id = d.user_id
          AND i.description = 'Forgiven: debt to ' || d.person
          AND i.amount = round((p->>'amount')::numeric, 2)
          AND i.date = (p->>'date')::date
        ORDER BY i.created_at LIMIT 1))
    ELSE p END
    ORDER BY t.ord)
  FROM jsonb_array_elements(d.paid_history) WITH ORDINALITY AS t(p, ord)
)
WHERE d.paid_history @> '[{"written_off": true}]';

-- Date each linked record on the day the loan was made
UPDATE expenses e SET date = l.date
FROM lendings l, jsonb_array_elements(l.paid_history) p
WHERE (p->>'written_off')::boolean IS TRUE AND (p->>'record_id')::uuid = e.id;

UPDATE incomes i SET date = d.date
FROM debts d, jsonb_array_elements(d.paid_history) p
WHERE (p->>'written_off')::boolean IS TRUE AND (p->>'record_id')::uuid = i.id;
