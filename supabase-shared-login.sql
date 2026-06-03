create table if not exists public.shared_budget_states (
  household_key text primary key,
  household_name text,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.shared_budget_states enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.shared_budget_states to anon, authenticated;

drop policy if exists "shared budget read" on public.shared_budget_states;
drop policy if exists "shared budget insert" on public.shared_budget_states;
drop policy if exists "shared budget update" on public.shared_budget_states;

create policy "shared budget read"
on public.shared_budget_states
for select
to anon
using (true);

create policy "shared budget insert"
on public.shared_budget_states
for insert
to anon
with check (true);

create policy "shared budget update"
on public.shared_budget_states
for update
to anon
using (true)
with check (true);
