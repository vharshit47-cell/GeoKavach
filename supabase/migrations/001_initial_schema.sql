-- Apply in the Supabase SQL editor. Passwords remain exclusively in Supabase Auth.
begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  preferred_language text not null default 'en' check (preferred_language in ('en', 'hi')),
  state text check (char_length(state) <= 120),
  district text check (char_length(district) <= 120),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paired_coordinates check ((latitude is null) = (longitude is null))
);

create table if not exists public.saved_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  latitude double precision not null check (latitude between 6 and 38),
  longitude double precision not null check (longitude between 68 and 98),
  state text check (char_length(state) <= 120),
  district text check (char_length(district) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists saved_locations_user_idx on public.saved_locations(user_id);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  earthquake_enabled boolean not null default true,
  flood_enabled boolean not null default true,
  landslide_enabled boolean not null default true,
  cyclone_enabled boolean not null default true,
  weather_enabled boolean not null default true,
  nearby_news_enabled boolean not null default false,
  browser_notifications_enabled boolean not null default false,
  notification_radius_km integer not null default 50 check (notification_radius_km in (10, 25, 50, 100, 250)),
  updated_at timestamptz not null default now()
);

create table if not exists public.alert_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_id text not null check (char_length(alert_id) between 1 and 500),
  alert_type text not null check (char_length(alert_type) between 1 and 60),
  seen_at timestamptz not null default now(),
  unique (user_id, alert_id)
);
create index if not exists alert_history_user_idx on public.alert_history(user_id);

-- Chat is intentionally not persisted by the application. This opt-in table is
-- available for a future explicit history-consent feature; no background inserts.
create table if not exists public.chat_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 12000),
  consent_given boolean not null check (consent_given is true),
  created_at timestamptz not null default now()
);
create index if not exists chat_history_user_idx on public.chat_history(user_id);

alter table public.profiles enable row level security;
alter table public.saved_locations enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.alert_history enable row level security;
alter table public.chat_history enable row level security;

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "locations_self" on public.saved_locations;
create policy "locations_self" on public.saved_locations for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "notification_preferences_self" on public.notification_preferences;
create policy "notification_preferences_self" on public.notification_preferences for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "alert_history_self" on public.alert_history;
create policy "alert_history_self" on public.alert_history for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "chat_history_self" on public.chat_history;
create policy "chat_history_self" on public.chat_history for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and consent_given);

revoke all on public.profiles, public.saved_locations, public.notification_preferences, public.alert_history, public.chat_history from anon;
grant select on public.profiles to authenticated;
-- Precise coordinates in profiles are reserved; saved_locations holds explicitly saved locations.
grant update(full_name, preferred_language, state, district) on public.profiles to authenticated;
grant select, insert, update, delete on public.saved_locations, public.notification_preferences, public.alert_history, public.chat_history to authenticated;

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists notification_preferences_updated_at on public.notification_preferences;
create trigger notification_preferences_updated_at before update on public.notification_preferences for each row execute function public.set_updated_at();

create or replace function public.create_suraksha_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, preferred_language, state, district)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    case when new.raw_user_meta_data ->> 'preferred_language' = 'hi' then 'hi' else 'en' end,
    left(new.raw_user_meta_data ->> 'state', 120),
    left(new.raw_user_meta_data ->> 'district', 120)
  ) on conflict (id) do nothing;
  insert into public.notification_preferences(user_id) values(new.id) on conflict(user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_suraksha_profile() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_suraksha on auth.users;
create trigger on_auth_user_created_suraksha after insert on auth.users for each row execute function public.create_suraksha_profile();

-- Existing project accounts receive profiles without importing any coordinates.
insert into public.profiles(id, full_name, preferred_language)
select id, left(coalesce(raw_user_meta_data ->> 'full_name', ''), 120),
       case when raw_user_meta_data ->> 'preferred_language' = 'hi' then 'hi' else 'en' end
from auth.users on conflict(id) do nothing;
insert into public.notification_preferences(user_id)
select id from auth.users on conflict(user_id) do nothing;

commit;
