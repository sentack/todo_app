# todo_app (Next.js + Supabase)

Small Next.js todo app scaffolded with create-next-app and integrated with Supabase (Auth + Postgres).

## Quick start

1. Install dependencies
   - npm: npm install
   - yarn: yarn
   - pnpm: pnpm install

2. Create `.env.local` in the project root and add (replace values from your Supabase project):
   - NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   - NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   - SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> (server-only — do NOT expose in the browser)

3. Run the dev server
   - npm run dev
   - Open http://localhost:3000

## How to get Supabase credentials (URL and keys)

1. Sign in or sign up at the Supabase dashboard: https://app.supabase.com
2. Create a new project (choose a name, password, and region).
3. After the project is created:
   - Go to Project Settings -> API.
   - Copy the "URL" value — this is your NEXT_PUBLIC_SUPABASE_URL.
   - Copy the "anon public" key labeled "anon key" — this is your NEXT_PUBLIC_SUPABASE_ANON_KEY (safe for client use).
   - Copy the "service_role" key under the "Service Role" section — this is SUPABASE_SERVICE_ROLE_KEY (must never be exposed to the browser; use only on server-side).
4. Paste those values into `.env.local`.

## Database

Schema and initial rows are in `database_query.sql` (located in the repo root). It assumes a Supabase project (uses `auth.users`):

- Creates users, todos, todo_status tables
- Inserts initial todo_status rows: pending, in-progress, completed
- Links todos.user_id -> auth.users(id)

To apply locally to your Supabase database you can use:
- Supabase CLI:
  - supabase db push
  - or run SQL via the Supabase SQL editor in the dashboard
- psql:
  - psql -h <HOST> -p <PORT> -U <USER> -d <DBNAME> -f database_query.sql

Make sure you run the SQL against your Supabase Postgres instance.

## Project layout (key files)

- app/
  - page.tsx — app entry page
  - auth/ — callback and error pages for sign-in
  - globals.css, layout.tsx
- lib/
  - supabaseBrowser.ts — client-side Supabase client (uses NEXT_PUBLIC_* keys)
  - supabaseServer.ts — server-side client (use service role key for protected operations)
- components/
  - AuthButton.tsx, LoginForm.tsx, ConfirmModal.tsx
  - TodoForm.tsx, TodoItem.tsx, TodoList.tsx, ThemeToggle.tsx
- database_query.sql — DB schema + seed data
- public/ — static assets (svg icons)
- img/ — screenshots used in README

## How the webapp works

- Authentication
  - Uses Supabase Auth. The client-side code (lib/supabaseBrowser.ts) handles sign-in and sign-out flows.
  - After successful authentication Supabase creates/associates an auth user in auth.users; the app reads the user's id to scope todos.
  - The app includes routes under app/auth/ to handle callbacks and errors during the auth flow.

- Data model
  - todos table stores individual todo items (title, description, notes, completed flag, status_id).
  - todo_status stores allowed status names (pending, in-progress, completed) and is joined via status_id.
  - todos.user_id references auth.users(id) so each user's todos are isolated.

- Client vs Server behavior
  - Client-side interactions (create, list, update, delete) call Supabase using the anon key through lib/supabaseBrowser.ts.
  - Sensitive operations that require elevated privileges (if added) should use lib/supabaseServer.ts which creates a server-only client with the service role key.
  - All UI components live under components/. Key UX pieces:
    - AuthButton.tsx / LoginForm.tsx — sign-in UI
    - TodoList.tsx — fetches and renders the user's todos
    - TodoForm.tsx — create / edit todo
    - TodoItem.tsx — individual todo row, complete/delete actions
    - ConfirmModal.tsx — confirmation dialogs (delete)
    - ThemeToggle.tsx — theme preference UI

- Typical flows
  - Viewing todos: After sign-in the app queries todos where user_id == current user and renders TodoList.
  - Creating todos: TodoForm posts a new row to todos with the current user_id and selected status.
  - Updating: Edit or toggle completed updates the todos row and sets updated_at.
  - Deleting: Deletes a todo (on delete cascade for user removal).

## Screenshots

Screenshots are included in the repo under the `img/` folder. Use these paths to view them in the README or locally:

- Login Page / Welcome Page
  ![Login Page](./img/ss%20(1).png)

- Create / Edit todo 
  ![Create todo screenshot](./img/ss%20(2).png)

- Todo List 
  ![Todo List](./img/ss%20(3).png)


## Live demo

A deployed demo is available at:
``` https://todo-app-sentack.vercel.app ```

Visit the link to see the app running (authentication requires Supabase configuration for your deployment).

## Deployment

- Vercel is recommended for Next.js apps:
  - Push this repo to Git and connect it to Vercel.
  - In Vercel dashboard, set environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (set the service role key only for server environment; keep it out of client builds).
- Database: point the Supabase project to a production DB and run `database_query.sql` (or migrate via Supabase tools).

## Security notes

- Never expose the SUPABASE_SERVICE_ROLE_KEY in client code, public repos, or browser-accessible environments.
- Use RLS (Row Level Security) and Supabase policies for production to enforce that users can only access their own todos.
- Use server-side functions for any admin-level operations.

## Troubleshooting

- If auth callback fails, check callback URL/redirect settings in your Supabase project's Auth settings.
- If queries return empty results, ensure the todos.user_id matches auth.users(id) from the signed-in user.
- Check browser console and Next.js server logs for Supabase client errors (invalid keys, CORS, etc).

## References

- Supabase dashboard: https://app.supabase.com
- Supabase docs (API keys and Auth): https://supabase.com/docs
