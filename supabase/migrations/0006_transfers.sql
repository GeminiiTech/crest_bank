create type public.transfer_kind as enum ('internal', 'external', 'wire');
create type public.transfer_status as enum ('pending', 'completed', 'failed', 'scheduled');

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  from_account_id uuid not null references public.accounts(id) on delete cascade,
  to_account_id uuid references public.accounts(id) on delete set null,
  beneficiary_id uuid references public.beneficiaries(id) on delete set null,
  amount numeric(19,4) not null check (amount > 0),
  currency char(3) not null default 'USD',
  kind public.transfer_kind not null default 'internal',
  status public.transfer_status not null default 'pending',
  reference text,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transfers_from_account_idx on public.transfers(from_account_id);

create trigger transfers_set_updated_at
  before update on public.transfers
  for each row execute function public.set_updated_at();
