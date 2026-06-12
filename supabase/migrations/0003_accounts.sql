create type public.account_type as enum ('checking', 'savings', 'current', 'business');
create type public.account_status as enum ('active', 'frozen', 'closed');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_number text not null unique,
  type public.account_type not null default 'checking',
  currency char(3) not null default 'USD',
  balance numeric(19,4) not null default 0,
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_user_id_idx on public.accounts(user_id);

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();
