-- ============================================================
--  TimurSounds · схема Supabase
--  Выполните целиком в SQL Editor вашего проекта Supabase.
--  Затем скопируйте URL проекта и anon public key
--  (Settings → API) в админ-панель площадки → «Синхронизация».
-- ============================================================

-- 1. Состояние площадки (треки, релизы, новости, анонсы, аккаунты, счётчики)
create table if not exists public.platform_state (
  id int primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

alter table public.platform_state enable row level security;

-- Демо-политики: чтение и запись по anon-ключу.
-- Для продакшена ограничьте запись (insert/update) отдельной ролью.
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

-- 2. Хранилище аудиофайлов треков (публичное чтение, запись по anon-ключу)
insert into storage.buckets (id, name, public)
values ('ts-audio', 'ts-audio', true)
on conflict (id) do nothing;

drop policy if exists "ts_audio_read" on storage.objects;
create policy "ts_audio_read" on storage.objects
  for select using (bucket_id = 'ts-audio');

drop policy if exists "ts_audio_insert" on storage.objects;
create policy "ts_audio_insert" on storage.objects
  for insert with check (bucket_id = 'ts-audio');

drop policy if exists "ts_audio_update" on storage.objects;
create policy "ts_audio_update" on storage.objects
  for update using (bucket_id = 'ts-audio');

drop policy if exists "ts_audio_delete" on storage.objects;
create policy "ts_audio_delete" on storage.objects
  for delete using (bucket_id = 'ts-audio');
