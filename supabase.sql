-- ============================================================
--  TimurSounds · схема Supabase
--  Выполните целиком в SQL Editor вашего проекта Supabase.
--  Затем скопируйте URL проекта и anon public key
--  (Settings → API) в админ-панель площадки → «Синхронизация».
-- ============================================================

create table if not exists public.platform_state (
  id int primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

alter table public.platform_state enable row level security;

-- Демо-политики: чтение и запись по anon-ключу.
-- Для продакшена ограничьте запись (insert/update) ролью admin.
drop policy if exists "ts_read" on public.platform_state;
create policy "ts_read" on public.platform_state for select using (true);

drop policy if exists "ts_insert" on public.platform_state;
create policy "ts_insert" on public.platform_state for insert with check (true);

drop policy if exists "ts_update" on public.platform_state;
create policy "ts_update" on public.platform_state for update using (true) with check (true);

-- Realtime: мгновенная доставка изменений всем открытым площадкам
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'platform_state'
  ) then
    alter publication supabase_realtime add table public.platform_state;
  end if;
end $$;
