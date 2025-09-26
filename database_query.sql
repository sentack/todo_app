create table users (
  id uuid references auth.users(id) primary key,  -- link to Supabase Auth
  username text,
  created_at timestamp with time zone default now()
);

create table todos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,  -- link todo to user
  title text not null,
  description text,
  notes text,                  -- long-form notes field
  completed boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table todo_status (
  id serial primary key,
  name text not null unique
);

insert into todo_status (name) values 
  ('pending'),
  ('in-progress'),
  ('completed');

alter table todos add column status_id int references todo_status(id) default 1;
