-- Harden: clients must not write account balances directly. All balance
-- mutation goes through execute_transfer (SECURITY DEFINER, bypasses RLS).
drop policy if exists "accounts update own" on public.accounts;

-- Atomic transfer: debit/credit + transaction rows + transfer row, all-or-nothing.
create or replace function public.execute_transfer(
  p_from_account uuid,
  p_to_account uuid,
  p_beneficiary uuid,
  p_amount numeric,
  p_kind text,
  p_reference text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_from public.accounts;
  v_to public.accounts;
  v_ben public.beneficiaries;
  v_transfer_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select * into v_from from public.accounts where id = p_from_account for update;
  if not found or v_from.user_id <> v_uid then
    raise exception 'Source account not found';
  end if;
  if v_from.status <> 'active' then
    raise exception 'Source account is not active';
  end if;
  if v_from.balance < p_amount then
    raise exception 'Insufficient funds';
  end if;

  if p_kind = 'internal' then
    if p_to_account is null then
      raise exception 'Destination account required';
    end if;
    if p_to_account = p_from_account then
      raise exception 'Cannot transfer to the same account';
    end if;
    select * into v_to from public.accounts where id = p_to_account for update;
    if not found or v_to.user_id <> v_uid then
      raise exception 'Destination account not found';
    end if;

    update public.accounts set balance = balance - p_amount where id = p_from_account;
    update public.accounts set balance = balance + p_amount where id = p_to_account;

    insert into public.transfers (from_account_id, to_account_id, amount, currency, kind, status, reference)
    values (p_from_account, p_to_account, p_amount, v_from.currency, 'internal', 'completed', p_reference)
    returning id into v_transfer_id;

    insert into public.transactions (account_id, type, category, amount, currency, status, description, counterparty, reference)
    values (p_from_account, 'debit', 'Transfer', p_amount, v_from.currency, 'completed',
            'Transfer to ' || coalesce(v_to.account_number, 'account'), 'Internal transfer', v_transfer_id::text);
    insert into public.transactions (account_id, type, category, amount, currency, status, description, counterparty, reference)
    values (p_to_account, 'credit', 'Transfer', p_amount, v_from.currency, 'completed',
            'Transfer from ' || coalesce(v_from.account_number, 'account'), 'Internal transfer', v_transfer_id::text);

  elsif p_kind in ('external', 'wire') then
    if p_beneficiary is null then
      raise exception 'Beneficiary required';
    end if;
    select * into v_ben from public.beneficiaries where id = p_beneficiary;
    if not found or v_ben.user_id <> v_uid then
      raise exception 'Beneficiary not found';
    end if;

    update public.accounts set balance = balance - p_amount where id = p_from_account;

    insert into public.transfers (from_account_id, beneficiary_id, amount, currency, kind, status, reference)
    values (p_from_account, p_beneficiary, p_amount, v_from.currency, p_kind::public.transfer_kind, 'completed', p_reference)
    returning id into v_transfer_id;

    insert into public.transactions (account_id, type, category, amount, currency, status, description, counterparty, reference)
    values (p_from_account, 'debit', 'Transfer', p_amount, v_from.currency, 'completed',
            'Transfer to ' || v_ben.name, coalesce(v_ben.bank_name, 'External'), v_transfer_id::text);
  else
    raise exception 'Invalid transfer kind';
  end if;

  return v_transfer_id;
end;
$$;

grant execute on function public.execute_transfer(uuid, uuid, uuid, numeric, text, text) to authenticated;
