-- Row-level security
--
-- recalls / recall_criteria: publicly readable so the matcher can run on
--   any user. Service role can write (for ingestion).
-- products: each user only sees their own.
-- matches: each user only sees matches against their own products.
-- notifications: each user only sees their own.

-- ---------------------------------------------------------------------------
-- recalls: public read, service-role write
-- ---------------------------------------------------------------------------
alter table recalls enable row level security;
alter table recall_criteria enable row level security;

create policy "recalls are publicly readable"
  on recalls for select
  using (true);

create policy "recall_criteria are publicly readable"
  on recall_criteria for select
  using (true);

-- Writes happen via the service role client (bypasses RLS).

-- ---------------------------------------------------------------------------
-- products: per-user
-- ---------------------------------------------------------------------------
alter table products enable row level security;

create policy "users see their own products"
  on products for select
  using (auth.uid() = user_id);

create policy "users can insert their own products"
  on products for insert
  with check (auth.uid() = user_id);

create policy "users can update their own products"
  on products for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete their own products"
  on products for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- matches: per-user (via product)
-- ---------------------------------------------------------------------------
alter table matches enable row level security;

create policy "users see matches for their own products"
  on matches for select
  using (
    exists (
      select 1 from products p
      where p.id = matches.product_id
      and p.user_id = auth.uid()
    )
  );

create policy "users can insert matches for their own products"
  on matches for insert
  with check (
    exists (
      select 1 from products p
      where p.id = matches.product_id
      and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- notifications: per-user
-- ---------------------------------------------------------------------------
alter table notifications enable row level security;

create policy "users see their own notifications"
  on notifications for select
  using (auth.uid() = user_id);

-- Writes via service role.