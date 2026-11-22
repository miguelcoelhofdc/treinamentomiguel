begin;

create table if not exists public.training_sync (
  profile text primary key check (profile in ('miguel', 'sintia')),
  revision integer not null check (revision > 0),
  records jsonb not null check (jsonb_typeof(records) = 'array'),
  deleted jsonb not null check (jsonb_typeof(deleted) = 'array')
);

alter table public.training_sync
  add column if not exists applied jsonb not null default '[]'::jsonb check (jsonb_typeof(applied) = 'array');

alter table public.training_sync enable row level security;
revoke all on table public.training_sync from public, anon, authenticated;
grant select, insert, update on table public.training_sync to service_role;

commit;
