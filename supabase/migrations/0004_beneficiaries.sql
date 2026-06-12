create type public.beneficiary_type as enum ('internal', 'external', 'wire');

create table public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  bank_name text,
  account_number text not null,
  routing_number text,
  iban text,
  type public.beneficiary_type not null default 'internal',
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index beneficiaries_user_id_idx on public.beneficiaries(user_id);

create trigger beneficiaries_set_updated_at
  before update on public.beneficiaries
  for each row execute function public.set_updated_at();
