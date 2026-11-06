-- Add auditability and reconciliation columns to public.dodo_payments
alter table public.dodo_payments
  add column if not exists customer_id text,
  add column if not exists product_id text,
  add column if not exists invoice_id text,
  add column if not exists receipt_url text;

-- Fast index for customer-level payment lookups
create index if not exists idx_dodo_payments_customer_id
  on public.dodo_payments (customer_id);

-- Fast index for product/tier payment analytics
create index if not exists idx_dodo_payments_product_id
  on public.dodo_payments (product_id);
