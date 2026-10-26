-- Timestamps the analytics need. Triggers keep them in sync whichever screen
-- flips the flag, so the app code doesn't have to set them.

-- ── todos.completed_at ──────────────────────────────────────────────
ALTER TABLE todos ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Best available estimate for todos completed before this column existed
UPDATE todos SET completed_at = updated_at WHERE completed AND completed_at IS NULL;

CREATE OR REPLACE FUNCTION set_todo_completed_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF COALESCE(NEW.completed, false) THEN
    IF TG_OP = 'INSERT' OR NOT COALESCE(OLD.completed, false) THEN
      NEW.completed_at := now();
    END IF;
  ELSE
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS todos_completed_at ON todos;
CREATE TRIGGER todos_completed_at
  BEFORE INSERT OR UPDATE OF completed ON todos
  FOR EACH ROW EXECUTE FUNCTION set_todo_completed_at();

-- ── to_buy_items.bought_at / expense_id ─────────────────────────────
ALTER TABLE to_buy_items ADD COLUMN IF NOT EXISTS bought_at timestamptz;
-- The expense logged when the item was bought (if any)
ALTER TABLE to_buy_items ADD COLUMN IF NOT EXISTS expense_id uuid REFERENCES expenses(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION set_to_buy_bought_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.bought THEN
    IF TG_OP = 'INSERT' OR NOT OLD.bought THEN
      NEW.bought_at := now();
    END IF;
  ELSE
    NEW.bought_at := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS to_buy_bought_at ON to_buy_items;
CREATE TRIGGER to_buy_bought_at
  BEFORE INSERT OR UPDATE OF bought ON to_buy_items
  FOR EACH ROW EXECUTE FUNCTION set_to_buy_bought_at();
