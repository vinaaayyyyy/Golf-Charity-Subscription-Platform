create extension if not exists pgcrypto;

-- Drop existing tables so you can safely re-run this script
drop table if exists public.audit_logs cascade;
drop table if exists public.payout_ledger cascade;
drop table if exists public.donation_ledger cascade;
drop table if exists public.charity_ledger cascade;
drop table if exists public.winner_claims cascade;
drop table if exists public.draw_results cascade;
drop table if exists public.monthly_draws cascade;
drop table if exists public.score_entries cascade;
drop table if exists public.subscriptions cascade;
drop table if exists public.profiles cascade;
drop table if exists public.plans cascade;
drop table if exists public.charity_events cascade;
drop table if exists public.charities cascade;
drop table if exists public.campaigns cascade;
drop table if exists public.organizations cascade;

-- Drop existing types
drop type if exists public.payout_status cascade;
drop type if exists public.ledger_source cascade;
drop type if exists public.claim_status cascade;
drop type if exists public.draw_tier cascade;
drop type if exists public.frequency_bias cascade;
drop type if exists public.draw_mode cascade;
drop type if exists public.charity_tier cascade;
drop type if exists public.plan_cadence cascade;
drop type if exists public.subscription_status cascade;
drop type if exists public.app_role cascade;

-- Drop functions and triggers attached to tables we don't drop (like auth.users)
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user cascade;
drop function if exists public.set_updated_at cascade;
drop function if exists public.enforce_rolling_scores cascade;
drop function if exists public.update_charity_total cascade;


create type public.app_role as enum ('subscriber', 'admin');
create type public.subscription_status as enum ('active', 'trialing', 'past_due', 'canceled', 'inactive', 'unpaid');
create type public.plan_cadence as enum ('monthly', 'yearly');
create type public.charity_tier as enum ('10', '15', '20', '25', '30');
create type public.draw_mode as enum ('random', 'algorithmic');
create type public.frequency_bias as enum ('most_frequent', 'least_frequent');
create type public.draw_tier as enum ('five_match', 'four_match', 'three_match');
create type public.claim_status as enum ('pending', 'approved', 'rejected', 'paid');
create type public.ledger_source as enum ('subscription', 'donation', 'adjustment');
create type public.payout_status as enum ('pending', 'paid');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  name text not null,
  slug text not null unique,
  active boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.charities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text not null,
  impact_tag text not null,
  description text not null,
  mission text not null,
  featured boolean not null default false,
  hero_image_url text,
  gallery_urls jsonb not null default '[]'::jsonb,
  total_raised_cents bigint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.charity_events (
  id uuid primary key default gen_random_uuid(),
  charity_id uuid not null references public.charities(id) on delete cascade,
  title text not null,
  summary text not null,
  location text not null,
  event_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cadence public.plan_cadence not null,
  base_amount_cents integer not null check (base_amount_cents > 0),
  yearly_savings_label text,
  stripe_lookup_key text not null unique,
  prize_pool_base_cents integer not null check (prize_pool_base_cents >= 0),
  base_charity_percent public.charity_tier not null default '10',
  enabled_tiers jsonb not null default '["10","15","20","25","30"]'::jsonb,
  country_code text not null default 'IN',
  currency_code text not null default 'INR',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null default '',
  email text not null unique,
  role public.app_role not null default 'subscriber',
  avatar_url text,
  selected_charity_id uuid references public.charities(id) on delete set null,
  charity_tier public.charity_tier not null default '10',
  country_code text not null default 'IN',
  currency_code text not null default 'INR',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  cadence public.plan_cadence not null,
  status public.subscription_status not null default 'inactive',
  charity_tier public.charity_tier not null default '10',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  latest_invoice_status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  country_code text not null default 'IN',
  currency_code text not null default 'INR',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.score_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  score smallint not null check (score between 1 and 45),
  played_at date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.monthly_draws (
  id uuid primary key default gen_random_uuid(),
  month_key date not null check (date_part('day', month_key) = 1),
  draw_mode public.draw_mode not null,
  frequency_bias public.frequency_bias,
  numbers integer[] not null check (cardinality(numbers) = 5),
  prize_pool_cents bigint not null default 0,
  rollover_from_previous_cents bigint not null default 0,
  five_match_pool_cents bigint not null default 0,
  four_match_pool_cents bigint not null default 0,
  three_match_pool_cents bigint not null default 0,
  charity_total_cents bigint not null default 0,
  simulation_only boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index monthly_draws_published_month_key_idx
on public.monthly_draws (month_key)
where simulation_only = false;

create table public.draw_results (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.monthly_draws(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  matched_count smallint not null check (matched_count in (3, 4, 5)),
  tier public.draw_tier not null,
  prize_cents bigint not null default 0,
  numbers_matched integer[] not null default '{}',
  claim_status public.claim_status,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.winner_claims (
  id uuid primary key default gen_random_uuid(),
  draw_result_id uuid not null unique references public.draw_results(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  proof_bucket text not null default 'winner-proofs',
  proof_path text not null,
  status public.claim_status not null default 'pending',
  notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.charity_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  charity_id uuid not null references public.charities(id) on delete restrict,
  source public.ledger_source not null,
  amount_cents bigint not null check (amount_cents >= 0),
  invoice_reference text,
  recorded_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.donation_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  charity_id uuid not null references public.charities(id) on delete restrict,
  stripe_payment_intent_id text unique,
  amount_cents bigint not null check (amount_cents > 0),
  recorded_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.payout_ledger (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.winner_claims(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents bigint not null check (amount_cents >= 0),
  status public.payout_status not null default 'pending',
  external_reference text,
  recorded_at timestamptz not null default timezone('utc', now()),
  paid_at timestamptz
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index subscriptions_user_status_idx on public.subscriptions (user_id, status);
create index score_entries_user_played_idx on public.score_entries (user_id, played_at desc, created_at desc);
create index draw_results_draw_tier_idx on public.draw_results (draw_id, tier);
create index winner_claims_status_idx on public.winner_claims (status, created_at desc);
create index charity_ledger_charity_recorded_idx on public.charity_ledger (charity_id, recorded_at desc);
create index donation_ledger_charity_recorded_idx on public.donation_ledger (charity_id, recorded_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

create or replace function public.viewer_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where auth_user_id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    auth_user_id,
    full_name,
    email,
    country_code,
    currency_code
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'country_code', 'IN'),
    coalesce(new.raw_user_meta_data ->> 'currency_code', 'INR')
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

create or replace function public.enforce_latest_five_scores()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from public.score_entries
  where user_id = new.user_id
    and id not in (
      select id
      from public.score_entries
      where user_id = new.user_id
      order by played_at desc, created_at desc
      limit 5
    );

  return new;
end;
$$;

create trigger score_entries_keep_latest_five
after insert or update on public.score_entries
for each row execute procedure public.enforce_latest_five_scores();

create or replace function public.apply_charity_total()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.charities
  set total_raised_cents = (
    select coalesce(sum(amount_cents), 0)
    from public.charity_ledger
    where charity_id = coalesce(new.charity_id, old.charity_id)
  ) + (
    select coalesce(sum(amount_cents), 0)
    from public.donation_ledger
    where charity_id = coalesce(new.charity_id, old.charity_id)
  ),
  updated_at = timezone('utc', now())
  where id = coalesce(new.charity_id, old.charity_id);

  return coalesce(new, old);
end;
$$;

create trigger charity_ledger_update_charity_total
after insert or update or delete on public.charity_ledger
for each row execute procedure public.apply_charity_total();

create trigger donation_ledger_update_charity_total
after insert or update or delete on public.donation_ledger
for each row execute procedure public.apply_charity_total();

create trigger organizations_set_updated_at before update on public.organizations for each row execute procedure public.set_updated_at();
create trigger campaigns_set_updated_at before update on public.campaigns for each row execute procedure public.set_updated_at();
create trigger charities_set_updated_at before update on public.charities for each row execute procedure public.set_updated_at();
create trigger charity_events_set_updated_at before update on public.charity_events for each row execute procedure public.set_updated_at();
create trigger plans_set_updated_at before update on public.plans for each row execute procedure public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions for each row execute procedure public.set_updated_at();
create trigger score_entries_set_updated_at before update on public.score_entries for each row execute procedure public.set_updated_at();
create trigger monthly_draws_set_updated_at before update on public.monthly_draws for each row execute procedure public.set_updated_at();
create trigger draw_results_set_updated_at before update on public.draw_results for each row execute procedure public.set_updated_at();
create trigger winner_claims_set_updated_at before update on public.winner_claims for each row execute procedure public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.campaigns enable row level security;
alter table public.charities enable row level security;
alter table public.charity_events enable row level security;
alter table public.plans enable row level security;
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.score_entries enable row level security;
alter table public.monthly_draws enable row level security;
alter table public.draw_results enable row level security;
alter table public.winner_claims enable row level security;
alter table public.charity_ledger enable row level security;
alter table public.donation_ledger enable row level security;
alter table public.payout_ledger enable row level security;
alter table public.audit_logs enable row level security;

create policy "public charities are readable"
on public.charities for select
using (true);

create policy "public charity events are readable"
on public.charity_events for select
using (true);

create policy "plans are readable"
on public.plans for select
using (true);

create policy "published draws are readable"
on public.monthly_draws for select
using (not simulation_only or public.is_admin());

create policy "profiles read own or admin"
on public.profiles for select
using (id = public.viewer_profile_id() or public.is_admin());

create policy "profiles update own or admin"
on public.profiles for update
using (id = public.viewer_profile_id() or public.is_admin())
with check (id = public.viewer_profile_id() or public.is_admin());

create policy "subscriptions read own or admin"
on public.subscriptions for select
using (user_id = public.viewer_profile_id() or public.is_admin());

create policy "subscriptions admin write"
on public.subscriptions for all
using (public.is_admin())
with check (public.is_admin());

create policy "scores read own or admin"
on public.score_entries for select
using (user_id = public.viewer_profile_id() or public.is_admin());

create policy "scores insert own or admin"
on public.score_entries for insert
with check (user_id = public.viewer_profile_id() or public.is_admin());

create policy "scores update own or admin"
on public.score_entries for update
using (user_id = public.viewer_profile_id() or public.is_admin())
with check (user_id = public.viewer_profile_id() or public.is_admin());

create policy "scores delete own or admin"
on public.score_entries for delete
using (user_id = public.viewer_profile_id() or public.is_admin());

create policy "draw results read own or admin"
on public.draw_results for select
using (user_id = public.viewer_profile_id() or public.is_admin());

create policy "draw results admin write"
on public.draw_results for all
using (public.is_admin())
with check (public.is_admin());

create policy "winner claims read own or admin"
on public.winner_claims for select
using (user_id = public.viewer_profile_id() or public.is_admin());

create policy "winner claims insert own or admin"
on public.winner_claims for insert
with check (user_id = public.viewer_profile_id() or public.is_admin());

create policy "winner claims update own or admin"
on public.winner_claims for update
using (user_id = public.viewer_profile_id() or public.is_admin())
with check (user_id = public.viewer_profile_id() or public.is_admin());

create policy "charity ledger read own or admin"
on public.charity_ledger for select
using (user_id = public.viewer_profile_id() or public.is_admin() or user_id is null);

create policy "charity ledger admin write"
on public.charity_ledger for all
using (public.is_admin())
with check (public.is_admin());

create policy "donation ledger read own or admin"
on public.donation_ledger for select
using (user_id = public.viewer_profile_id() or public.is_admin() or user_id is null);

create policy "donation ledger insert own or admin"
on public.donation_ledger for insert
with check (user_id = public.viewer_profile_id() or public.is_admin() or user_id is null);

create policy "payout ledger read own or admin"
on public.payout_ledger for select
using (user_id = public.viewer_profile_id() or public.is_admin());

create policy "payout ledger admin write"
on public.payout_ledger for all
using (public.is_admin())
with check (public.is_admin());

create policy "audit logs admin only"
on public.audit_logs for select
using (public.is_admin());

create policy "audit logs admin write"
on public.audit_logs for all
using (public.is_admin())
with check (public.is_admin());

create policy "organizations readable by authenticated users"
on public.organizations for select
using (auth.role() = 'authenticated');

create policy "campaigns readable by authenticated users"
on public.campaigns for select
using (auth.role() = 'authenticated');

create policy "organizations admin write"
on public.organizations for all
using (public.is_admin())
with check (public.is_admin());

create policy "campaigns admin write"
on public.campaigns for all
using (public.is_admin())
with check (public.is_admin());

create policy "charities admin write"
on public.charities for all
using (public.is_admin())
with check (public.is_admin());

create policy "charity events admin write"
on public.charity_events for all
using (public.is_admin())
with check (public.is_admin());

create policy "plans admin write"
on public.plans for all
using (public.is_admin())
with check (public.is_admin());

create policy "draws admin write"
on public.monthly_draws for all
using (public.is_admin())
with check (public.is_admin());
drop policy if exists "winner proof upload by owner or admin" on storage.objects;
drop policy if exists "winner proof read by owner or admin" on storage.objects;
drop policy if exists "winner proof update by admin" on storage.objects;
drop policy if exists "winner proof delete by admin" on storage.objects;

insert into storage.buckets (id, name, public)
values ('winner-proofs', 'winner-proofs', false)
on conflict (id) do nothing;

create policy "winner proof upload by owner or admin"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'winner-proofs'
  and (
    public.is_admin()
    or split_part(name, '/', 1) = auth.uid()::text
  )
);

create policy "winner proof read by owner or admin"
on storage.objects for select
to authenticated
using (
  bucket_id = 'winner-proofs'
  and (
    public.is_admin()
    or split_part(name, '/', 1) = auth.uid()::text
  )
);

create policy "winner proof update by admin"
on storage.objects for update
to authenticated
using (bucket_id = 'winner-proofs' and public.is_admin())
with check (bucket_id = 'winner-proofs' and public.is_admin());

create policy "winner proof delete by admin"
on storage.objects for delete
to authenticated
using (bucket_id = 'winner-proofs' and public.is_admin());
