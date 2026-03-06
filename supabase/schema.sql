-- Swingstr schema for Supabase (Analyzr-style: students → lessons → swings)
-- Run in Supabase SQL Editor. Create a bucket "swing-videos" in Storage for video files.

-- Students (coach-facing profile)
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  email text,
  phone text,
  notes text,
  handicap text,
  goals text,
  distances text,
  physical_limits text
);

-- Lessons (dated per student)
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_date date not null,
  notes text,
  created_at timestamptz default now()
);

create index if not exists lessons_student_id on public.lessons(student_id);

-- Swings (videos/photos per lesson, with tags and markers)
create table if not exists public.swings (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  label text not null,
  media_path text,
  media_url text,
  view_tag text,
  swing_type text,
  location text,
  club_type text,
  high_speed boolean default false,
  color_label text,
  markers jsonb default '[]',
  created_at timestamptz default now()
);

create index if not exists swings_lesson_id on public.swings(lesson_id);

-- Optional: enable RLS and policies for multi-user (e.g. by auth.uid())
-- alter table public.students enable row level security;
-- create policy "Users can manage own students" on public.students for all using (true);
