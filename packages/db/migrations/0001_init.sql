-- RecallLens AI — initial schema
--
-- Tables:
--   recalls            one row per recall notice (any source)
--   recall_criteria    one row per matching criterion within a recall
--   products           one row per product the user has scanned
--   matches            one row per (product, recall) evaluation
--   notifications      one row per notification sent (de-duped)
--
-- All tables have RLS enabled in migration 0002.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- recalls
-- ---------------------------------------------------------------------------
create table recalls (
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

create index recalls_brand_idx on recalls (brand);
create index recalls_category_idx on recalls (category);
create index recalls_published_idx on recalls (published_at desc);

-- ---------------------------------------------------------------------------
-- recall_criteria — structured matching criteria within a recall
-- ---------------------------------------------------------------------------
create table recall_criteria (
  id          uuid primary key default gen_random_uuid(),
  recall_id   uuid not null references recalls(id) on delete cascade,
  field       text not null check (field in ('brand','product_name','lot_code','serial','mfg_date')),
  operator    text not null check (operator in ('eq','prefix','contains','range','regex')),
  value       jsonb not null,
  raw_text    text,
  created_at  timestamptz not null default now()
);

create index recall_criteria_recall_idx on recall_criteria (recall_id);
create index recall_criteria_field_idx on recall_criteria (field);

-- ---------------------------------------------------------------------------
-- products — user's scanned products
-- ---------------------------------------------------------------------------
create table products (
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

create index products_user_idx on products (user_id);
create index products_brand_idx on products (brand);
create index products_product_name_idx on products (product_name);

-- ---------------------------------------------------------------------------
-- matches — every match attempt
-- ---------------------------------------------------------------------------
create table matches (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id) on delete cascade,
  recall_id     uuid not null references recalls(id) on delete cascade,
  outcome       text not null check (outcome in ('potential_match','no_match','more_info_needed','unable_to_verify')),
  confidence    numeric(4,3) not null check (confidence between 0 and 1),
  explanation   jsonb not null,
  missing_fields text[] not null default '{}',
  created_at    timestamptz not null default now()
);

create index matches_product_idx on matches (product_id);
create index matches_recall_idx on matches (recall_id);
create index matches_outcome_idx on matches (outcome);
create index matches_created_idx on matches (created_at desc);

-- ---------------------------------------------------------------------------
-- notifications — outbound notifications (de-duped by product/recall/channel)
-- ---------------------------------------------------------------------------
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  recall_id   uuid not null references recalls(id) on delete cascade,
  channel     text not null check (channel in ('email','push','in_app')),
  sent_at     timestamptz not null default now(),
  unique (product_id, recall_id, channel)
);

create index notifications_user_idx on notifications (user_id, sent_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger for recalls
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger recalls_set_updated_at
  before update on recalls
  for each row execute function set_updated_at();