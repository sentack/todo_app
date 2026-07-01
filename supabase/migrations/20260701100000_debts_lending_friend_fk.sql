-- Add friend_id FK to debts and lendings, then backfill from friends table
-- Run this AFTER running scripts/seed-friends.mjs so all person names already exist as friends

ALTER TABLE debts    ADD COLUMN IF NOT EXISTS friend_id uuid REFERENCES friends(id) ON DELETE SET NULL;
ALTER TABLE lendings ADD COLUMN IF NOT EXISTS friend_id uuid REFERENCES friends(id) ON DELETE SET NULL;

-- Backfill: match by user_id + case-insensitive person name
UPDATE debts d
SET    friend_id = f.id
FROM   friends f
WHERE  f.user_id = d.user_id
  AND  lower(trim(f.name)) = lower(trim(d.person))
  AND  d.friend_id IS NULL;

UPDATE lendings l
SET    friend_id = f.id
FROM   friends f
WHERE  f.user_id = l.user_id
  AND  lower(trim(f.name)) = lower(trim(l.person))
  AND  l.friend_id IS NULL;

-- Summary
SELECT 'debts'    AS tbl, count(*) AS total, count(friend_id) AS linked FROM debts
UNION ALL
SELECT 'lendings', count(*),                  count(friend_id)            FROM lendings;
