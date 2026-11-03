create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  last_notified_month text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_month_format
    check (last_notified_month is null or last_notified_month ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

grant select, insert, update, delete on public.push_subscriptions to authenticated;

create policy "Users can read their own push subscriptions"
on public.push_subscriptions for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own push subscriptions"
on public.push_subscriptions for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own push subscriptions"
on public.push_subscriptions for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own push subscriptions"
on public.push_subscriptions for delete to authenticated
using ((select auth.uid()) = user_id);
