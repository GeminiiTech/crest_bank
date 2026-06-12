-- Enable RLS on all app tables (deny-by-default once enabled)
alter table public.profiles        enable row level security;
alter table public.accounts        enable row level security;
alter table public.beneficiaries   enable row level security;
alter table public.transactions    enable row level security;
alter table public.transfers       enable row level security;
alter table public.cards           enable row level security;
alter table public.notifications   enable row level security;
alter table public.support_tickets enable row level security;

-- profiles: owner select/update (no insert from client; trigger handles creation)
create policy "profiles select own" on public.profiles for select using (auth.uid() = id);
create policy "profiles update own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- accounts: owner full access
create policy "accounts select own" on public.accounts for select using (auth.uid() = user_id);
create policy "accounts insert own" on public.accounts for insert with check (auth.uid() = user_id);
create policy "accounts update own" on public.accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- beneficiaries: owner full access
create policy "beneficiaries select own" on public.beneficiaries for select using (auth.uid() = user_id);
create policy "beneficiaries insert own" on public.beneficiaries for insert with check (auth.uid() = user_id);
create policy "beneficiaries update own" on public.beneficiaries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "beneficiaries delete own" on public.beneficiaries for delete using (auth.uid() = user_id);

-- transactions: select/insert scoped to owned accounts; no client update/delete (financial immutability)
create policy "transactions select own" on public.transactions for select
  using (account_id in (select id from public.accounts where user_id = auth.uid()));
create policy "transactions insert own" on public.transactions for insert
  with check (account_id in (select id from public.accounts where user_id = auth.uid()));

-- transfers: select/insert scoped to owned source account; no client update/delete
create policy "transfers select own" on public.transfers for select
  using (from_account_id in (select id from public.accounts where user_id = auth.uid()));
create policy "transfers insert own" on public.transfers for insert
  with check (from_account_id in (select id from public.accounts where user_id = auth.uid()));

-- cards: scoped to owned accounts
create policy "cards select own" on public.cards for select
  using (account_id in (select id from public.accounts where user_id = auth.uid()));
create policy "cards insert own" on public.cards for insert
  with check (account_id in (select id from public.accounts where user_id = auth.uid()));
create policy "cards update own" on public.cards for update
  using (account_id in (select id from public.accounts where user_id = auth.uid()))
  with check (account_id in (select id from public.accounts where user_id = auth.uid()));

-- notifications: owner select/update (mark read)
create policy "notifications select own" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications update own" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- support_tickets: owner full access
create policy "tickets select own" on public.support_tickets for select using (auth.uid() = user_id);
create policy "tickets insert own" on public.support_tickets for insert with check (auth.uid() = user_id);
create policy "tickets update own" on public.support_tickets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
