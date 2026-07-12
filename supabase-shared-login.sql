create table if not exists public.shared_budget_states (
  household_key text primary key,
  household_name text,
  payload jsonb not null,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.shared_budget_states
add column if not exists revision bigint not null default 0;

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

create or replace function public.save_shared_budget_state(
  p_household_key text,
  p_household_name text,
  p_payload jsonb,
  p_expected_revision bigint
)
returns table(saved boolean, current_payload jsonb, current_revision bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.shared_budget_states as budget
  set
    household_name = p_household_name,
    payload = p_payload,
    revision = budget.revision + 1,
    updated_at = now()
  where budget.household_key = p_household_key
    and budget.revision = p_expected_revision
  returning true, budget.payload, budget.revision
  into saved, current_payload, current_revision;

  if found then
    return next;
    return;
  end if;

  if p_expected_revision = 0 then
    insert into public.shared_budget_states (
      household_key,
      household_name,
      payload,
      revision,
      updated_at
    )
    values (
      p_household_key,
      p_household_name,
      p_payload,
      1,
      now()
    )
    on conflict (household_key) do nothing
    returning true, shared_budget_states.payload, shared_budget_states.revision
    into saved, current_payload, current_revision;

    if found then
      return next;
      return;
    end if;
  end if;

  return query
  select false, budget.payload, budget.revision
  from public.shared_budget_states as budget
  where budget.household_key = p_household_key;
end;
$$;

grant execute on function public.save_shared_budget_state(text, text, jsonb, bigint) to anon, authenticated;
