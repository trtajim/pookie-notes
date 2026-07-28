-- 1. WIPE OUT ALL EXISTING DATA AND ACCOUNTS
drop table if exists notes cascade;
drop table if exists couples cascade;
drop table if exists profiles cascade;
drop function if exists is_in_couple;

-- This deletes all registered users so you start completely fresh!
delete from auth.users;

-- 2. CREATE PROFILES TABLE (For Nicknames)
create table profiles (
  id uuid references auth.users primary key,
  display_name text not null
);

alter table profiles enable row level security;
create policy "Public profiles are viewable by everyone." on profiles for select using (true);
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);

-- 3. CREATE COUPLES TABLE (For Rooms & Approvals)
create table couples (
  id uuid default uuid_generate_v4() primary key,
  user1_id uuid references profiles(id) not null,
  user2_id uuid references profiles(id),
  pending_user2_id uuid references profiles(id),
  pairing_code text unique not null
);

alter table couples enable row level security;
create policy "Couples are viewable by everyone." on couples for select using (true);
create policy "Users can create their couple." on couples for insert with check (auth.uid() = user1_id);
create policy "Users can update couples." on couples for update using (true); 
create policy "Anyone can delete couples" on couples for delete using (true);

-- 4. CREATE NOTES TABLE (With Colors & Last Edited)
create table notes (
  id uuid default uuid_generate_v4() primary key,
  couple_id uuid references couples(id) on delete cascade not null,
  created_by uuid references profiles(id) not null,
  last_edited_by uuid references profiles(id),
  title text,
  content text,
  color text default '#ffe5ec',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table notes enable row level security;

-- 5. CREATE HELPER FUNCTION FOR SECURITY
create or replace function is_in_couple(cid uuid) returns boolean as $$
begin
  return exists (
    select 1 from couples
    where id = cid and (user1_id = auth.uid() or user2_id = auth.uid())
  );
end;
$$ language plpgsql security definer;

-- 6. SET UP NOTES SECURITY POLICIES
create policy "Couples can view notes." on notes for select using (is_in_couple(couple_id));
create policy "Couples can create notes." on notes for insert with check (is_in_couple(couple_id));
create policy "Couples can update notes." on notes for update using (is_in_couple(couple_id));
create policy "Couples can delete notes." on notes for delete using (is_in_couple(couple_id));