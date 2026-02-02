-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor) to create tables and RLS.
-- Replace if you already have tables with different names.

-- Students: each row belongs to the authenticated user
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  notes text default '',
  created_at timestamptz default now()
);

-- Videos: metadata for files stored in Storage; each row belongs to the user
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  date text,
  storage_path text not null,
  created_at timestamptz default now()
);

-- Row Level Security: users only see their own data
alter table public.students enable row level security;
alter table public.videos enable row level security;

create policy "Users can manage own students"
  on public.students for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own videos"
  on public.videos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Optional: index for faster lookups
create index if not exists students_user_id_idx on public.students(user_id);
create index if not exists videos_student_id_idx on public.videos(student_id);
create index if not exists videos_user_id_idx on public.videos(user_id);

-- Storage bucket: create in Dashboard → Storage → New bucket named "videos"
-- Then in Storage → Policies for bucket "videos", add:
--   Policy name: "Users can upload/read/delete own videos"
--   Allowed operation: All (or separate: SELECT, INSERT, DELETE)
--   Policy: (bucket_id = 'videos') and (auth.uid()::text = (storage.foldername(name))[1])
-- So we'll store files as: {user_id}/{student_id}/{filename}
-- Alternatively use a simpler policy: auth.role() = 'authenticated' and auth.uid() is not null
-- and restrict by path prefix in app (path = user_id/...). For simplicity we can use:
--   "Users can do all" with check: true for authenticated users (then enforce path in app).
--
-- In Supabase Storage UI, add policy for bucket "videos":
--   Name: "Authenticated users can manage own folder"
--   Policy definition (custom): 
--     (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text)
--   for ALL operations (SELECT, INSERT, UPDATE, DELETE).
