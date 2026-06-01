-- ============================================================
-- Migration 005: Property types + Expense splitting
-- ============================================================

-- ── Property type enum ────────────────────────────────────────

create type property_type as enum ('hostel', 'pg', 'shared');

-- ── Add property_type to hostels ──────────────────────────────

alter table hostels
  add column property_type property_type not null default 'hostel';

-- ── Expenses table (flexible splits for shared apartments) ────

create type expense_category as enum (
  'rent', 'electricity', 'water', 'internet',
  'groceries', 'household', 'food', 'transport', 'other'
);

create table expenses (
  id           uuid primary key default gen_random_uuid(),
  hostel_id    uuid not null references hostels(id) on delete cascade,
  created_by   uuid not null references profiles(id) on delete cascade,
  paid_by      uuid not null references profiles(id) on delete cascade,
  title        text not null,
  description  text,
  total_amount numeric(10,2) not null check(total_amount > 0),
  category     expense_category not null default 'other',
  date         date not null default current_date,
  is_settled   bool not null default false,
  created_at   timestamptz not null default now()
);

create index expenses_hostel_idx on expenses(hostel_id, date desc);
create index expenses_paid_by_idx on expenses(paid_by);

-- ── Expense splits (who owes how much) ───────────────────────

create table expense_splits (
  id           uuid primary key default gen_random_uuid(),
  expense_id   uuid not null references expenses(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  amount       numeric(10,2) not null check(amount >= 0),
  is_paid      bool not null default false,
  paid_at      timestamptz,
  note         text,
  unique(expense_id, user_id)
);

create index expense_splits_expense_idx on expense_splits(expense_id);
create index expense_splits_user_idx    on expense_splits(user_id);

-- ── RLS for expenses ──────────────────────────────────────────

alter table expenses       enable row level security;
alter table expense_splits enable row level security;

-- Same hostel can read all expenses
create policy "expenses_select"
  on expenses for select
  using (hostel_id = get_my_hostel_id());

create policy "expenses_insert"
  on expenses for insert
  with check (
    hostel_id = get_my_hostel_id()
    and created_by = auth.uid()
  );

create policy "expenses_update_own"
  on expenses for update
  using (hostel_id = get_my_hostel_id() and created_by = auth.uid());

create policy "expenses_delete_own"
  on expenses for delete
  using (hostel_id = get_my_hostel_id() and created_by = auth.uid());

-- Splits: same hostel members
create policy "expense_splits_select"
  on expense_splits for select
  using (
    exists (
      select 1 from expenses e
      where e.id = expense_id
        and e.hostel_id = get_my_hostel_id()
    )
  );

create policy "expense_splits_insert"
  on expense_splits for insert
  with check (
    exists (
      select 1 from expenses e
      where e.id = expense_id
        and e.hostel_id = get_my_hostel_id()
    )
  );

create policy "expense_splits_update"
  on expense_splits for update
  using (
    exists (
      select 1 from expenses e
      where e.id = expense_id
        and e.hostel_id = get_my_hostel_id()
    )
  );

-- ── Realtime for expenses ─────────────────────────────────────

alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table expense_splits;

-- ── Update hostel_code generation to be more readable ─────────
-- Format: 3 letters + 3 digits (e.g. SUN-281)

create or replace function generate_hostel_code()
returns text
language plpgsql
as $$
declare
  code text;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ'; -- no I or O (confusing)
begin
  code := substr(chars, floor(random()*22+1)::int, 1)
       || substr(chars, floor(random()*22+1)::int, 1)
       || substr(chars, floor(random()*22+1)::int, 1)
       || '-'
       || lpad(floor(random()*900+100)::text, 3, '0');
  return code;
end;
$$;

-- Re-generate hostel codes with the new readable format
update hostels
set hostel_code = generate_hostel_code()
where true;

-- Add unique constraint if not already there
alter table hostels
  drop constraint if exists hostels_hostel_code_key;
alter table hostels
  add constraint hostels_hostel_code_key unique (hostel_code);
