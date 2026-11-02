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
