create extension if not exists pgcrypto;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  first_name text,
  last_name text,
  age integer,
  height numeric,
  weight numeric,
  unit_preference text not null default 'oz' check (unit_preference in ('oz', 'ml')),
  wake_time text not null default '07:00',
  sleep_time text not null default '22:00',
  activity_level text not null default 'moderate' check (activity_level in ('light', 'moderate', 'high')),
  daily_goal numeric not null default 80,
  interval_length integer not null default 60,
  theme text not null default 'midnight',
  custom_accent_color text,
  gradient_preset text,
  reminders_enabled boolean not null default true,
  reminder_interval integer not null default 60,
  quiet_hours_start text not null default '22:00',
  quiet_hours_end text not null default '07:00',
  sound_enabled boolean not null default true,
  vibration_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

-- Water logs
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null,
  drink_type text not null default 'Water',
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Custom beverages
create table if not exists public.beverages (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  serving_size numeric not null default 8,
  hydration_factor numeric not null default 1.0,
  icon text default 'droplet',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Scanned beverages
create table if not exists public.scanned_beverages (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  barcode text not null,
  name text not null,
  serving_size numeric not null,
  hydration_factor numeric not null default 1.0,
  created_at timestamptz not null default now()
);

-- AI chat history
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_user_id on public.profiles(user_id);
create index if not exists idx_water_logs_profile_logged_at on public.water_logs(profile_id, logged_at desc);
create index if not exists idx_beverages_profile_id on public.beverages(profile_id);
create index if not exists idx_scanned_beverages_profile_id on public.scanned_beverages(profile_id);
create index if not exists idx_chat_messages_profile_id on public.chat_messages(profile_id);

alter table public.profiles enable row level security;
alter table public.water_logs enable row level security;
alter table public.beverages enable row level security;
alter table public.scanned_beverages enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
on public.profiles for select
using (user_id = auth.uid());

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
on public.profiles for insert
with check (user_id = auth.uid());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete their own profile" on public.profiles;
create policy "Users can delete their own profile"
on public.profiles for delete
using (user_id = auth.uid());

drop policy if exists "Users can view their own water logs" on public.water_logs;
create policy "Users can view their own water logs"
on public.water_logs for select
using (exists (
  select 1 from public.profiles
  where profiles.id = water_logs.profile_id
  and profiles.user_id = auth.uid()
));

drop policy if exists "Users can create their own water logs" on public.water_logs;
create policy "Users can create their own water logs"
on public.water_logs for insert
with check (exists (
  select 1 from public.profiles
  where profiles.id = water_logs.profile_id
  and profiles.user_id = auth.uid()
));

drop policy if exists "Users can delete their own water logs" on public.water_logs;
create policy "Users can delete their own water logs"
on public.water_logs for delete
using (exists (
  select 1 from public.profiles
  where profiles.id = water_logs.profile_id
  and profiles.user_id = auth.uid()
));

drop policy if exists "Users can view their own beverages" on public.beverages;
create policy "Users can view their own beverages"
on public.beverages for select
using (exists (
  select 1 from public.profiles
  where profiles.id = beverages.profile_id
  and profiles.user_id = auth.uid()
));

drop policy if exists "Users can create their own beverages" on public.beverages;
create policy "Users can create their own beverages"
on public.beverages for insert
with check (exists (
  select 1 from public.profiles
  where profiles.id = beverages.profile_id
  and profiles.user_id = auth.uid()
));

drop policy if exists "Users can update their own beverages" on public.beverages;
create policy "Users can update their own beverages"
on public.beverages for update
using (exists (
  select 1 from public.profiles
  where profiles.id = beverages.profile_id
  and profiles.user_id = auth.uid()
))
with check (exists (
  select 1 from public.profiles
  where profiles.id = beverages.profile_id
  and profiles.user_id = auth.uid()
));

drop policy if exists "Users can delete their own beverages" on public.beverages;
create policy "Users can delete their own beverages"
on public.beverages for delete
using (exists (
  select 1 from public.profiles
  where profiles.id = beverages.profile_id
  and profiles.user_id = auth.uid()
));

drop policy if exists "Users can view their own scanned beverages" on public.scanned_beverages;
create policy "Users can view their own scanned beverages"
on public.scanned_beverages for select
using (exists (
  select 1 from public.profiles
  where profiles.id = scanned_beverages.profile_id
  and profiles.user_id = auth.uid()
));

drop policy if exists "Users can create their own scanned beverages" on public.scanned_beverages;
create policy "Users can create their own scanned beverages"
on public.scanned_beverages for insert
with check (exists (
  select 1 from public.profiles
  where profiles.id = scanned_beverages.profile_id
  and profiles.user_id = auth.uid()
));

drop policy if exists "Users can delete their own scanned beverages" on public.scanned_beverages;
create policy "Users can delete their own scanned beverages"
on public.scanned_beverages for delete
using (exists (
  select 1 from public.profiles
  where profiles.id = scanned_beverages.profile_id
  and profiles.user_id = auth.uid()
));

drop policy if exists "Users can view their own chat messages" on public.chat_messages;
create policy "Users can view their own chat messages"
on public.chat_messages for select
using (exists (
  select 1 from public.profiles
  where profiles.id = chat_messages.profile_id
  and profiles.user_id = auth.uid()
));

drop policy if exists "Users can create their own chat messages" on public.chat_messages;
create policy "Users can create their own chat messages"
on public.chat_messages for insert
with check (exists (
  select 1 from public.profiles
  where profiles.id = chat_messages.profile_id
  and profiles.user_id = auth.uid()
));

drop policy if exists "Users can delete their own chat messages" on public.chat_messages;
create policy "Users can delete their own chat messages"
on public.chat_messages for delete
using (exists (
  select 1 from public.profiles
  where profiles.id = chat_messages.profile_id
  and profiles.user_id = auth.uid()
));
