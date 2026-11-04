-- Обновление базы (включает и всё из 002). Выполнить один раз:
-- Supabase → SQL Editor → New query → вставить всё → Run. Повторный запуск безопасен.

-- «Часть зала»: женская / мужская
alter table public.guests add column if not exists part text not null default 'w' check (part in ('w','m'));

-- Коды удалённых гостей больше не выдаются
create table if not exists public.retired_codes (code text primary key, retired_at timestamptz not null default now());

-- Имя по-узбекски и тип приглашения (личное / общее)
alter table public.guests add column if not exists name_uz text;
alter table public.guests add column if not exists kind text not null default 'one' check (kind in ('one','group'));

-- Ответы по общим приглашениям: каждый отвечает за себя
create table if not exists public.group_answers (
  id         bigint generated always as identity primary key,
  guest_id   bigint not null references public.guests(id) on delete cascade,
  device     text not null,
  name       text not null check (char_length(name) between 1 and 80),
  coming     int  not null default 0 check (coming between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guest_id, device)
);

-- Пожелания по общим приглашениям подписываются именем отправителя
alter table public.wishes add column if not exists author text;
alter table public.wishes add column if not exists device text;

-- Настройки (текст письма по умолчанию)
create table if not exists public.settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());

alter table public.retired_codes enable row level security;
alter table public.group_answers enable row level security;
alter table public.settings enable row level security;
revoke all on public.retired_codes, public.group_answers, public.settings from anon, authenticated;
grant all on public.retired_codes, public.group_answers, public.settings to service_role;

notify pgrst, 'reload schema';
