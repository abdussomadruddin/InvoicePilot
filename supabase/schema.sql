create extension if not exists pgcrypto;

create table if not exists public.invoice_clients (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  brand_client text not null,
  name text not null default '',
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  company_name text not null default '',
  registration_number text not null default '',
  billing_name text not null default '',
  billing_address text not null default '',
  monthly_retainer numeric(12, 2) not null default 0,
  drive_folder_id text not null default '',
  drive_folder_name text not null default '',
  weekly_report_folder_id text not null default '',
  invoice_receipt_folder_id text not null default '',
  source text not null default 'supabase',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_settings (
  id text primary key default 'default',
  name text not null default '',
  registration_number text not null default '',
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  payment_details text not null default '',
  bank_name text not null default '',
  bank_account_number text not null default '',
  bank_account_name text not null default '',
  payment_link text not null default '',
  logo_path text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_settings_singleton check (id = 'default')
);

create table if not exists public.invoice_uploads (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  period text not null,
  client_code text not null,
  client_name text not null default '',
  invoice_date date,
  service_price numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  currency text not null default 'MYR',
  drive_file_id text not null default '',
  drive_file_name text not null default '',
  drive_file_url text not null default '',
  invoice_receipt_folder_id text not null default '',
  replaced boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoice_clients_brand_client_idx on public.invoice_clients (brand_client);
create index if not exists invoice_uploads_period_idx on public.invoice_uploads (period);
create index if not exists invoice_uploads_client_code_idx on public.invoice_uploads (client_code);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists invoice_clients_touch_updated_at on public.invoice_clients;
create trigger invoice_clients_touch_updated_at
before update on public.invoice_clients
for each row execute function public.touch_updated_at();

drop trigger if exists business_settings_touch_updated_at on public.business_settings;
create trigger business_settings_touch_updated_at
before update on public.business_settings
for each row execute function public.touch_updated_at();

drop trigger if exists invoice_uploads_touch_updated_at on public.invoice_uploads;
create trigger invoice_uploads_touch_updated_at
before update on public.invoice_uploads
for each row execute function public.touch_updated_at();

alter table public.invoice_clients enable row level security;
alter table public.business_settings enable row level security;
alter table public.invoice_uploads enable row level security;
