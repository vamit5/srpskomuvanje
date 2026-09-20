-- Privremena dijagnostika (ista ideja kao email_debug_log) -- beleži TACNU
-- Stripe gresku umesto nase generic poruke "Ne mogu trenutno da pokrenem
-- plaćanje", da konacno vidimo STVARAN razlog bez nagadjanja/Vercel logova.
create table if not exists stripe_debug_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  context text,
  error_text text
);

alter table stripe_debug_log enable row level security;
