-- RecallLens AI — combined schema (idempotent).
--
-- Run against your Supabase project:
--   psql "$DATABASE_URL" -f schema.sql
--   -- or paste the contents into the Supabase SQL editor.
--
-- Order matters: extensions → tables → indexes → triggers → RLS.
-- This file is safe to re-run; every CREATE uses IF NOT EXISTS where
-- Postgres allows it, and policies/triggers are dropped-and-recreated.

-- ===========================================================================
-- 1. Extensions
-- ===========================================================================
create extension if not exists "pgcrypto";

-- ===========================================================================
-- 2. Tables
-- ===========================================================================

-- recalls: one row per recall notice (any source)
create table if not exists recalls (
  id            uuid primary key default gen_random_uuid(),
  source        text not null check (source in ('cpsc','fda','usda','nhtsa','manual')),
  source_id     text not null,
  title         text not null,
  description   text not null,
  brand         text,
  product_name  text,
  category      text,
  source_url    text not null,
  published_at  timestamptz not null,
  raw_payload   jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (source, source_id)
);

-- recall_criteria: one row per matching criterion within a recall
create table if not exists recall_criteria (
  id          uuid primary key default gen_random_uuid(),
  recall_id   uuid not null references recalls(id) on delete cascade,
  field       text not null check (field in ('brand','product_name','lot_code','serial','mfg_date')),
  operator    text not null check (operator in ('eq','prefix','contains','range','regex')),
  value       jsonb not null,
  raw_text    text,
  created_at  timestamptz not null default now()
);

-- products: user's scanned products
create table if not exists products (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  brand                text,
  product_name         text,
  variant              text,
  category             text,
  lot_code             text,
  mfg_date             date,
  expiry_date          date,
  image_url            text,
  product_confidence   numeric(4,3) not null check (product_confidence between 0 and 1),
  lot_confidence       numeric(4,3) not null check (lot_confidence between 0 and 1),
  photo_type           text not null check (photo_type in ('full_product','front_only','back_only','unclear')),
  notes                text,
  created_at           timestamptz not null default now()
);

-- matches: every match attempt
create table if not exists matches (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id) on delete cascade,
  recall_id     uuid not null references recalls(id) on delete cascade,
  outcome       text not null check (outcome in ('potential_match','no_match','more_info_needed','unable_to_verify')),
  confidence    numeric(4,3) not null check (confidence between 0 and 1),
  explanation   jsonb not null,
  missing_fields text[] not null default '{}',
  created_at    timestamptz not null default now()
);

-- notifications: outbound notifications (de-duped)
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  recall_id   uuid not null references recalls(id) on delete cascade,
  channel     text not null check (channel in ('email','push','in_app')),
  sent_at     timestamptz not null default now(),
  unique (product_id, recall_id, channel)
);

-- ===========================================================================
-- 3. Indexes
-- ===========================================================================
create index if not exists recalls_brand_idx      on recalls (brand);
create index if not exists recalls_category_idx   on recalls (category);
create index if not exists recalls_published_idx  on recalls (published_at desc);

create index if not exists recall_criteria_recall_idx on recall_criteria (recall_id);
create index if not exists recall_criteria_field_idx  on recall_criteria (field);

create index if not exists products_user_idx           on products (user_id);
create index if not exists products_brand_idx          on products (brand);
create index if not exists products_product_name_idx   on products (product_name);

create index if not exists matches_product_idx   on matches (product_id);
create index if not exists matches_recall_idx    on matches (recall_id);
create index if not exists matches_outcome_idx   on matches (outcome);
create index if not exists matches_created_idx   on matches (created_at desc);

create index if not exists notifications_user_idx on notifications (user_id, sent_at desc);

-- ===========================================================================
-- 4. Triggers
-- ===========================================================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists recalls_set_updated_at on recalls;
create trigger recalls_set_updated_at
  before update on recalls
  for each row execute function set_updated_at();

-- ===========================================================================
-- 5. Row-level security
-- ===========================================================================
-- recalls / recall_criteria: publicly readable so the matcher can run on any
-- user. Service role can write (for ingestion).
alter table recalls         enable row level security;
alter table recall_criteria enable row level security;

drop policy if exists "recalls are publicly readable"          on recalls;
drop policy if exists "recall_criteria are publicly readable"  on recall_criteria;

create policy "recalls are publicly readable"
  on recalls for select using (true);

create policy "recall_criteria are publicly readable"
  on recall_criteria for select using (true);

-- products: each user only sees their own.
alter table products enable row level security;

drop policy if exists "users see their own products"            on products;
drop policy if exists "users can insert their own products"     on products;
drop policy if exists "users can update their own products"     on products;
drop policy if exists "users can delete their own products"     on products;

create policy "users see their own products"
  on products for select using (auth.uid() = user_id);

create policy "users can insert their own products"
  on products for insert with check (auth.uid() = user_id);

create policy "users can update their own products"
  on products for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete their own products"
  on products for delete using (auth.uid() = user_id);

-- matches: each user only sees matches against their own products.
alter table matches enable row level security;

drop policy if exists "users see matches for their own products"        on matches;
drop policy if exists "users can insert matches for their own products" on matches;

create policy "users see matches for their own products"
  on matches for select using (
    exists (
      select 1 from products p
      where p.id = matches.product_id
        and p.user_id = auth.uid()
    )
  );

create policy "users can insert matches for their own products"
  on matches for insert with check (
    exists (
      select 1 from products p
      where p.id = matches.product_id
        and p.user_id = auth.uid()
    )
  );

-- notifications: per-user.
alter table notifications enable row level security;

drop policy if exists "users see their own notifications" on notifications;

create policy "users see their own notifications"
  on notifications for select using (auth.uid() = user_id);