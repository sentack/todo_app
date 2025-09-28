/*
  # Create subtasks table

  1. New Tables
    - `subtasks`
      - `id` (uuid, primary key)
      - `todo_id` (uuid, foreign key to todos)
      - `title` (text, required)
      - `completed` (boolean, default false)
      - `weight` (integer, default 1, range 1-5)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `subtasks` table
    - Add policies for authenticated users to manage their subtasks
*/

CREATE TABLE IF NOT EXISTS subtasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id uuid REFERENCES todos(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean DEFAULT false,
  weight integer DEFAULT 1 CHECK (weight >= 1 AND weight <= 5),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to read subtasks for their todos
CREATE POLICY "Users can read subtasks for their todos"
  ON subtasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM todos 
      WHERE todos.id = subtasks.todo_id 
      AND todos.user_id = auth.uid()
    )
  );

-- Policy to allow users to insert subtasks for their todos
CREATE POLICY "Users can insert subtasks for their todos"
  ON subtasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM todos 
      WHERE todos.id = subtasks.todo_id 
      AND todos.user_id = auth.uid()
    )
  );

-- Policy to allow users to update subtasks for their todos
CREATE POLICY "Users can update subtasks for their todos"
  ON subtasks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM todos 
      WHERE todos.id = subtasks.todo_id 
      AND todos.user_id = auth.uid()
    )
  );

-- Policy to allow users to delete subtasks for their todos
CREATE POLICY "Users can delete subtasks for their todos"
  ON subtasks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM todos 
      WHERE todos.id = subtasks.todo_id 
      AND todos.user_id = auth.uid()
    )
  );