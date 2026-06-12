create type public.txn_type as enum ('credit', 'debit');
create type public.txn_status as enum ('pending', 'completed', 'failed', 'reversed');

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  type public.txn_type not null,
  category text not null default 'general',
  amount numeric(19,4) not null check (amount >= 0),
  currency char(3) not null default 'USD',
  status public.txn_status not null default 'completed',
  description text,
  counterparty text,
  reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_account_created_idx on public.transactions(account_id, created_at desc);
create index transactions_category_idx on public.transactions(category);
create index transactions_status_idx on public.transactions(status);

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();
