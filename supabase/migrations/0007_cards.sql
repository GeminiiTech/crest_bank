create type public.card_type as enum ('debit', 'credit');
create type public.card_status as enum ('active', 'frozen', 'cancelled');

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  brand text not null default 'Visa',
  type public.card_type not null default 'debit',
  last4 char(4) not null,
  exp_month smallint not null check (exp_month between 1 and 12),
  exp_year smallint not null,
  status public.card_status not null default 'active',
  is_virtual boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cards_account_id_idx on public.cards(account_id);

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();
