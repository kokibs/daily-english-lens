create table if not exists public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  diary_english text not null,
  diary_japanese text not null,
  photos jsonb not null default '[]'::jsonb,
  moments jsonb not null default '[]'::jsonb,
  expressions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_entries_user_date_key unique (user_id, entry_date)
);

alter table public.daily_entries enable row level security;

create policy "Users can read their own daily entries"
on public.daily_entries for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own daily entries"
on public.daily_entries for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own daily entries"
on public.daily_entries for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own daily entries"
on public.daily_entries for delete
to authenticated
using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'daily-photos',
  'daily-photos',
  false,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their own daily photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'daily-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can upload their own daily photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'daily-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can update their own daily photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'daily-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'daily-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can delete their own daily photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'daily-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
