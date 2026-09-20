-- Privremena dijagnostička tabela -- beleži TAČNU grešku kad slanje mejla
-- (Gmail SMTP) ne uspe, jer Vercel-ovi logovi na ovom planu drže samo mali
-- rolling bafer (prebrzo se prepisuju da bi se uhvatila greška uzivo).
-- Bez RLS politika (zakljucano za sve osim service-role admin klijenta,
-- koji jedini i cita/pise ovde) -- cisto dijagnostika, moze se obrisati
-- kasnije kad se email slanje potvrdi da radi pouzdano.
create table if not exists email_debug_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  to_email text,
  error_text text
);

alter table email_debug_log enable row level security;
