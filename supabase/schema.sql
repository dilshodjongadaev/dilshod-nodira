-- Wedding invitation · Dilshodjon & Nodira
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.
create table if not exists public.guests (
  id           bigint generated always as identity primary key,
  code         text not null unique check (code ~ '^[A-Z0-9]{4,6}$'),
  name         text not null,
  greet        text not null default 'Дорогие',
  seats        int  not null default 1 check (seats between 1 and 20),
  table_no     int,
  status       text not null default 'none' check (status in ('none','opened','yes','no')),
  coming       int  not null default 0,
  lang         text not null default 'ru' check (lang in ('ru','uzl','uzc')),
  side         text not null default 'both',
  grp          text not null default 'oth',
  line         text not null default '',
  part         text not null default 'w' check (part in ('w','m')),
  note         text,
  tg_chat_id   bigint,
  opened_at    timestamptz,
  answered_at  timestamptz,
  reminded_at  timestamptz,
  created_at   timestamptz not null default now()
);
create table if not exists public.wishes (
  id         bigint generated always as identity primary key,
  guest_id   bigint not null references public.guests(id) on delete cascade,
  text       text not null check (char_length(text) <= 1000),
  created_at timestamptz not null default now()
);
create table if not exists public.attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists attempts_ip_at on public.attempts (ip, at);
create index if not exists wishes_guest on public.wishes (guest_id);

-- Nobody from the browser can read or write these tables directly; only the site's server (secret key) can.
alter table public.guests   enable row level security;
alter table public.wishes   enable row level security;
alter table public.attempts enable row level security;
revoke all on public.guests, public.wishes, public.attempts from anon, authenticated;
grant all on public.guests, public.wishes, public.attempts to service_role;

-- codes of deleted guests are never handed out again
create table if not exists public.retired_codes (code text primary key, retired_at timestamptz not null default now());
alter table public.retired_codes enable row level security;
revoke all on public.retired_codes from anon, authenticated;
grant all on public.retired_codes to service_role;

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
