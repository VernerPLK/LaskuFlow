create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'csv',
  bank_name text,
  iban text,
  status text not null default 'not_connected',
  consent_expires_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bank_connection_id uuid references public.bank_connections(id) on delete set null,
  external_transaction_id text,
  booking_date date not null,
  value_date date,
  amount numeric(12,2) not null,
  currency text not null default 'EUR',
  debtor_name text,
  creditor_name text,
  remittance_information text,
  reference_number text,
  message text,
  raw_payload jsonb default '{}'::jsonb,
  matched_invoice_id uuid references public.invoices(id) on delete set null,
  match_status text not null default 'unmatched',
  created_at timestamptz default now(),
  unique (organization_id, external_transaction_id)
);

create table if not exists public.reminder_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  enabled boolean default true,
  rule_type text not null,
  days_offset integer not null default 0,
  subject_template text not null,
  body_template text not null,
  add_fee boolean default false,
  fee_amount numeric(12,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  reminder_type text not null,
  subject text not null,
  body text not null,
  sent_to text,
  sent_at timestamptz,
  status text not null default 'pending',
  created_at timestamptz default now(),
  unique (invoice_id, reminder_type)
);

create table if not exists public.collection_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  provider text not null default 'mock_collection',
  status text not null default 'ready_for_review',
  amount numeric(12,2) not null default 0,
  submitted_at timestamptz,
  resolved_at timestamptz,
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (invoice_id, provider)
);

create index if not exists idx_bank_transactions_reference on public.bank_transactions (organization_id, reference_number);
create index if not exists idx_bank_transactions_match_status on public.bank_transactions (organization_id, match_status);
create index if not exists idx_reminders_invoice on public.reminders (invoice_id, reminder_type);
create index if not exists idx_collection_cases_status on public.collection_cases (organization_id, status);

do $$
declare t text;
begin
  foreach t in array array['bank_connections','bank_transactions','reminder_rules','reminders','collection_cases'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

select public.create_policy_if_missing('bank_connections_org_all','bank_connections','create policy bank_connections_org_all on public.bank_connections for all to authenticated using (organization_id in (select private.current_user_organization_ids())) with check (organization_id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('bank_transactions_org_all','bank_transactions','create policy bank_transactions_org_all on public.bank_transactions for all to authenticated using (organization_id in (select private.current_user_organization_ids())) with check (organization_id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('reminder_rules_org_all','reminder_rules','create policy reminder_rules_org_all on public.reminder_rules for all to authenticated using (organization_id in (select private.current_user_organization_ids())) with check (organization_id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('reminders_org_all','reminders','create policy reminders_org_all on public.reminders for all to authenticated using (organization_id in (select private.current_user_organization_ids())) with check (organization_id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('collection_cases_org_all','collection_cases','create policy collection_cases_org_all on public.collection_cases for all to authenticated using (organization_id in (select private.current_user_organization_ids())) with check (organization_id in (select private.current_user_organization_ids()))');
