create extension if not exists pgcrypto;
create schema if not exists private;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.create_policy_if_missing(policy_name text, table_name text, policy_sql text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = table_name and policyname = policy_name
  ) then
    execute policy_sql;
  end if;
end;
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_id text,
  vat_number text,
  address text,
  postal_code text,
  city text,
  country text default 'FI',
  phone text,
  email text,
  website text,
  logo_url text,
  default_iban text,
  default_bic text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','employee','accountant')),
  created_at timestamptz default now(),
  unique (organization_id, user_id)
);

create or replace function private.current_user_organization_ids()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select organization_id from public.organization_members where user_id = (select auth.uid());
$$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null default 'company' check (type in ('company','person')),
  name text not null,
  business_id text,
  vat_number text,
  contact_person text,
  email text,
  phone text,
  address text,
  postal_code text,
  city text,
  country text default 'FI',
  einvoice_address text,
  einvoice_operator text,
  default_payment_terms integer default 14,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  unit text default 'kpl',
  unit_price_ex_vat numeric(12,2) not null default 0,
  vat_rate numeric(5,2) not null default 25.50,
  product_code text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  invoice_number text not null,
  reference_number text not null,
  issue_date date not null default current_date,
  due_date date not null,
  payment_terms integer not null default 14,
  status text not null default 'draft' check (status in ('draft','sent','open','due_soon','overdue','reminder_sent','second_reminder_sent','ready_for_collection','in_collection','partially_paid','paid','credited','cancelled')),
  currency text not null default 'EUR',
  subtotal_ex_vat numeric(12,2) not null default 0,
  vat_total numeric(12,2) not null default 0,
  total_inc_vat numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  amount_open numeric(12,2) not null default 0,
  payment_link text,
  pdf_url text,
  notes_to_customer text,
  internal_notes text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, invoice_number),
  unique (organization_id, reference_number)
);

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit text default 'kpl',
  unit_price_ex_vat numeric(12,2) not null,
  discount_percent numeric(5,2) default 0,
  vat_rate numeric(5,2) not null default 25.50,
  line_total_ex_vat numeric(12,2) not null,
  line_vat numeric(12,2) not null,
  line_total_inc_vat numeric(12,2) not null,
  created_at timestamptz default now()
);

create table if not exists public.payment_providers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_key text not null check (provider_key in ('mock','stripe','paytrail','bank_transfer','mobilepay','checkout_finland','visma_pay')),
  provider_name text not null,
  status text not null default 'not_connected' check (status in ('not_connected','connected','test_mode','live_mode','error','disabled')),
  mode text not null default 'test' check (mode in ('test','live')),
  api_public_key text,
  api_secret_key_encrypted text,
  merchant_id text,
  webhook_secret_encrypted text,
  webhook_url text,
  supported_methods jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, provider_key)
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_id uuid references public.payment_providers(id) on delete cascade,
  method_key text not null check (method_key in ('card','bank_payment','mobilepay','bank_transfer','invoice_pdf','mock')),
  display_name text not null,
  enabled boolean default true,
  sort_order integer default 0,
  icon_name text,
  customer_description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, provider_id, method_key)
);

create table if not exists public.payment_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  public_token text unique not null,
  status text not null default 'active' check (status in ('active','expired','paid','cancelled')),
  expires_at timestamptz,
  success_url text,
  cancel_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.payment_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  payment_link_id uuid references public.payment_links(id) on delete set null,
  provider_id uuid references public.payment_providers(id) on delete set null,
  provider_key text not null,
  provider_session_id text,
  provider_payment_id text,
  selected_method text,
  amount numeric(12,2) not null,
  currency text not null default 'EUR',
  status text not null default 'created' check (status in ('created','pending','requires_action','succeeded','failed','cancelled','expired','partially_paid')),
  checkout_url text,
  customer_email text,
  metadata jsonb default '{}'::jsonb,
  raw_provider_payload jsonb default '{}'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  payment_session_id uuid references public.payment_sessions(id) on delete set null,
  provider_id uuid references public.payment_providers(id) on delete set null,
  provider_key text not null,
  provider_event_id text,
  event_type text not null,
  status text not null check (status in ('received','processed','ignored','failed')),
  amount numeric(12,2),
  currency text default 'EUR',
  raw_payload jsonb not null default '{}'::jsonb,
  processing_error text,
  created_at timestamptz default now(),
  processed_at timestamptz,
  unique (provider_key, provider_event_id)
);

create table if not exists public.payment_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  provider_key text not null,
  headers jsonb default '{}'::jsonb,
  body jsonb default '{}'::jsonb,
  signature_valid boolean default false,
  event_type text,
  provider_event_id text,
  status text default 'received',
  error_message text,
  created_at timestamptz default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(12,2) not null,
  currency text not null default 'EUR',
  payment_date timestamptz not null default now(),
  payment_method text,
  reference_number text,
  bank_transaction_id uuid,
  provider_key text,
  provider_payment_id text,
  status text not null default 'succeeded' check (status in ('pending','succeeded','failed','cancelled','refunded')),
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.payments add column if not exists payment_session_id uuid references public.payment_sessions(id) on delete set null;
alter table public.payments add column if not exists payment_event_id uuid references public.payment_events(id) on delete set null;
alter table public.payments add column if not exists provider_key text;
alter table public.payments add column if not exists provider_payment_id text;
alter table public.payments add column if not exists provider_fee numeric(12,2);
alter table public.payments add column if not exists net_amount numeric(12,2);
alter table public.payments add column if not exists reconciliation_status text default 'unmatched';
alter table public.payments add column if not exists failure_code text;
alter table public.payments add column if not exists failure_message text;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete cascade,
  event_type text not null check (event_type in ('invoice_email_sent','receipt_email_sent','payment_reminder_sent','collection_warning_sent','email_failed')),
  to_email text not null,
  from_email text not null,
  subject text not null,
  provider_message_id text,
  status text not null default 'sent',
  error_message text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_invoices_org_status on public.invoices (organization_id, status);
create index if not exists idx_invoices_reference on public.invoices (organization_id, reference_number);
create index if not exists idx_payment_links_token on public.payment_links (public_token);
create index if not exists idx_payment_sessions_invoice on public.payment_sessions (invoice_id, status);
create index if not exists idx_payment_events_session on public.payment_events (payment_session_id, status);
create index if not exists idx_webhook_provider_event on public.payment_webhook_deliveries (provider_key, provider_event_id);
create index if not exists idx_payments_invoice on public.payments (invoice_id, status);

create or replace function public.ensure_default_payment_providers(target_org uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.payment_providers (organization_id, provider_key, provider_name, status, mode, supported_methods, settings)
  values
    (target_org, 'mock', 'Mock-maksu', 'test_mode', 'test', '["mock"]', '{"customerVisible":true}'),
    (target_org, 'bank_transfer', 'Tilisiirto', 'connected', 'live', '["bank_transfer","invoice_pdf"]', '{"customerVisible":true}'),
    (target_org, 'stripe', 'Stripe', 'not_connected', 'test', '["card"]', '{"requiresEnv":["STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET","NEXT_PUBLIC_APP_URL"]}'),
    (target_org, 'paytrail', 'Paytrail', 'not_connected', 'test', '["bank_payment","card","mobilepay"]', '{"integrationReady":true}'),
    (target_org, 'mobilepay', 'MobilePay', 'not_connected', 'test', '["mobilepay"]', '{"integrationReady":true}'),
    (target_org, 'checkout_finland', 'Checkout Finland', 'not_connected', 'test', '["bank_payment","card"]', '{"integrationReady":true}'),
    (target_org, 'visma_pay', 'Visma Pay', 'not_connected', 'test', '["bank_payment","card"]', '{"integrationReady":true}')
  on conflict (organization_id, provider_key) do nothing;

  insert into public.payment_methods (organization_id, provider_id, method_key, display_name, sort_order, customer_description)
  select target_org, id, 'mock', 'Testimaksu', 10, 'Käytössä vain testaukseen.' from public.payment_providers where organization_id = target_org and provider_key = 'mock'
  on conflict do nothing;

  insert into public.payment_methods (organization_id, provider_id, method_key, display_name, sort_order, customer_description)
  select target_org, id, 'bank_transfer', 'Tilisiirto', 50, 'Maksa lasku IBANilla ja viitenumerolla.' from public.payment_providers where organization_id = target_org and provider_key = 'bank_transfer'
  on conflict do nothing;
end;
$$;

create or replace function public.create_payment_link_for_invoice(target_invoice uuid)
returns text language plpgsql security definer set search_path = public as $$
declare inv record; token text;
begin
  select * into inv from public.invoices where id = target_invoice;
  if not found then raise exception 'invoice not found'; end if;
  perform public.ensure_default_payment_providers(inv.organization_id);
  token := encode(gen_random_bytes(32), 'hex');
  insert into public.payment_links (organization_id, invoice_id, public_token, status)
  values (inv.organization_id, inv.id, token, 'active');
  update public.invoices set payment_link = '/pay/' || token, updated_at = now() where id = inv.id;
  insert into public.audit_logs (organization_id, action, entity_type, entity_id, metadata)
  values (inv.organization_id, 'payment_link_created', 'invoice', inv.id, jsonb_build_object('tokenTail', right(token, 6)));
  return token;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['organizations','customers','products','invoices','payment_providers','payment_methods','payment_links','payment_sessions'] loop
    if not exists (select 1 from pg_trigger where tgname = 'touch_' || t) then
      execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', 'touch_' || t, t);
    end if;
  end loop;

  foreach t in array array['organizations','users','organization_members','customers','products','invoices','invoice_lines','payment_providers','payment_methods','payment_links','payment_sessions','payment_events','payment_webhook_deliveries','payments','audit_logs','email_events'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

select public.create_policy_if_missing('org_member_select_organizations','organizations','create policy org_member_select_organizations on public.organizations for select to authenticated using (id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('org_member_update_organizations','organizations','create policy org_member_update_organizations on public.organizations for update to authenticated using (id in (select private.current_user_organization_ids())) with check (id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('users_self_select','users','create policy users_self_select on public.users for select to authenticated using (id = (select auth.uid()))');
select public.create_policy_if_missing('users_self_insert','users','create policy users_self_insert on public.users for insert to authenticated with check (id = (select auth.uid()))');
select public.create_policy_if_missing('members_org_select','organization_members','create policy members_org_select on public.organization_members for select to authenticated using (organization_id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('customers_org_all','customers','create policy customers_org_all on public.customers for all to authenticated using (organization_id in (select private.current_user_organization_ids())) with check (organization_id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('products_org_all','products','create policy products_org_all on public.products for all to authenticated using (organization_id in (select private.current_user_organization_ids())) with check (organization_id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('invoices_org_all','invoices','create policy invoices_org_all on public.invoices for all to authenticated using (organization_id in (select private.current_user_organization_ids())) with check (organization_id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('payment_providers_org_all','payment_providers','create policy payment_providers_org_all on public.payment_providers for all to authenticated using (organization_id in (select private.current_user_organization_ids())) with check (organization_id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('payment_methods_org_all','payment_methods','create policy payment_methods_org_all on public.payment_methods for all to authenticated using (organization_id in (select private.current_user_organization_ids())) with check (organization_id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('payment_links_org_all','payment_links','create policy payment_links_org_all on public.payment_links for all to authenticated using (organization_id in (select private.current_user_organization_ids())) with check (organization_id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('payment_sessions_org_all','payment_sessions','create policy payment_sessions_org_all on public.payment_sessions for all to authenticated using (organization_id in (select private.current_user_organization_ids())) with check (organization_id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('payment_events_org_all','payment_events','create policy payment_events_org_all on public.payment_events for all to authenticated using (organization_id in (select private.current_user_organization_ids())) with check (organization_id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('payments_org_all','payments','create policy payments_org_all on public.payments for all to authenticated using (organization_id in (select private.current_user_organization_ids())) with check (organization_id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('audit_logs_org_select','audit_logs','create policy audit_logs_org_select on public.audit_logs for select to authenticated using (organization_id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('email_events_org_select','email_events','create policy email_events_org_select on public.email_events for select to authenticated using (organization_id in (select private.current_user_organization_ids()))');
