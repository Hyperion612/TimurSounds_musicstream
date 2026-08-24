-- ============================================================
-- TimurSounds · схема Supabase для синхронизации площадки
-- Выполните целиком в SQL Editor вашего проекта Supabase.
-- ============================================================

-- 1. Таблица состояния площадки (одна строка — весь контент)
create table if not exists public.platform_state (
  id int primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.platform_state (id, data)
values (1, '{"v":1,"artists":{},"tracks":[],"releases":[],"news":[],"upcoming":[],"plays":{}}'::jsonb)
on conflict (id) do nothing;

-- 2. RLS: анонимный доступ на чтение и запись (демо-режим лейбла).
--    Для продакшена можно ограничить запись паролем через RPC.
alter table public.platform_state enable row level security;

drop policy if exists "public read platform_state" on public.platform_state;
create policy "public read platform_state"
  on public.platform_state for select using (true);

drop policy if exists "public write platform_state" on public.platform_state;
create policy "public write platform_state"
  on public.platform_state for all using (true) with check (true);

-- 3. Realtime: изменения таблицы рассылаются всем клиентам мгновенно
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'platform_state'
  ) then
    alter publication supabase_realtime add table public.platform_state;
  end if;
end $$;

-- 4. Автоматически обновляем updated_at
create or replace function public.touch_platform_state()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists platform_state_touch on public.platform_state;
create trigger platform_state_touch
  before update on public.platform_state
  for each row execute function public.touch_platform_state();

-- Готово! Далее в настройках GitHub-репозитория добавьте секреты:
--   VITE_SUPABASE_URL       — URL проекта (Settings → API)
--   VITE_SUPABASE_ANON_KEY  — ключ anon public (Settings → API)
