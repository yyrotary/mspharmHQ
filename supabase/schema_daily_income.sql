-- Create daily_income table
create table if not exists daily_income (
  date date primary key,
  income integer default 0, -- 일반 매출 (General Sales)
  expense integer default 0, -- 본부/조제 차감 (HQ Deduction)
  net_income integer default 0, -- 정산 합계 (Settlement Total)
  pos integer default 0, -- POS 매출
  diff integer default 0, -- 차액
  
  -- Detailed columns for reference (Optional but good for data integrity)
  cas5 integer default 0,
  cas1 integer default 0,
  gif integer default 0,
  car1 integer default 0,
  car2 integer default 0,
  person integer default 0, -- Same as expense but keeping raw name
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add comments for clarity
comment on table daily_income is 'Daily income and expense records migrated from Notion';
comment on column daily_income.income is 'General Sales (cas5 + cas1 + gif + car1 + car2)';
comment on column daily_income.expense is 'HQ/Dispensing Deduction (person)';
comment on column daily_income.net_income is 'Settlement Total (income - expense)';

-- Enable Row Level Security (RLS)
alter table daily_income enable row level security;

-- Create policy to allow read access for authenticated users
create policy "Allow read access for authenticated users" on daily_income
  for select using (auth.role() = 'authenticated');

-- Create policy to allow all access for service role (admin)
create policy "Enable all access for service role" on daily_income
  for all using (auth.role() = 'service_role');
