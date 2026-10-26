-- IANA timezone (e.g. 'Africa/Addis_Ababa') used to decide which calendar day
-- "today" is and which day a timestamp falls on. NULL = follow the device.
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone text;
