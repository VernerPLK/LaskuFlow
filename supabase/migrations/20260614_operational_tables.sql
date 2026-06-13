create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  receipt_number text not null,
  receipt_date date not null default current_date,
  payment_method text not null default 'card',
  subtotal_ex_vat numeric(12,2) not null default 0,
  vat_total numeric(12,2) not null default 0,
  total_inc_vat numeric(12,2) not null default 0,
  pdf_url text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, receipt_number)
);

create table if not exists public.imported_bank_rows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  booking_date date not null,
  amount numeric(12,2) not null,
  currency text not null default 'EUR',
  payer_name text,
  reference_number text,
  message text,
  import_batch_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  matched_invoice_id uuid references public.invoices(id) on delete set null,
  match_status text not null default 'unmatched',
  created_at timestamptz default now()
);

create table if not exists public.reminder_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  enabled boolean not null default true,
  rule_type text not null,
  days_offset integer not null default 0,
  subject_template text not null,
  body_template text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, rule_type)
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  reminder_type text not null,
  subject text not null,
  body text not null,
  sent_to text not null,
  sent_at timestamptz,
  status text not null default 'scheduled',
  created_at timestamptz default now(),
  unique (invoice_id, reminder_type)
);

create table if not exists public.collection_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  provider text not null default 'mock_collection',
  status text not null default 'ready',
  amount numeric(12,2) not null,
  submitted_at timestamptz,
  resolved_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_imported_bank_rows_reference on public.imported_bank_rows (organization_id, reference_number);
create index if not exists idx_imported_bank_rows_match_status on public.imported_bank_rows (organization_id, match_status);
create index if not exists idx_collection_cases_status on public.collection_cases (organization_id, status);
