-- AIMdropin initial schema: catalog, user pages, stars, ratings, usage
-- events, per-item stats and ranking. Everything is protected by RLS;
-- the indexer writes the catalog with the service role key, which
-- bypasses RLS and never reaches the browser.

-- ---------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9][a-z0-9-]{1,38}$'),
  display_name text check (char_length(display_name) <= 80),
  avatar_url text,
  website text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles are public" on public.profiles for select using (true);
create policy "users edit their own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Create a profile row for every new user.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Catalog (license-checked third-party items; written by the indexer)
-- Mirrors CatalogItem in lib/catalog/types.ts.
-- ---------------------------------------------------------------------

-- Search document: title weighs most, then categories, then description.
-- Declared immutable (it is, for a fixed text search config) so it can
-- back a generated column; array_to_string alone is only stable.
create function public.catalog_search_doc(title text, categories text[], description text)
returns tsvector language sql immutable as $$
  select setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
         setweight(to_tsvector('english'::regconfig, coalesce(array_to_string(categories, ' '), '')), 'B') ||
         setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'C');
$$;

create table public.catalog_items (
  id text primary key,
  source_id text not null,
  source_kind text not null check (source_kind in ('shadcn-registry', 'html-collection', 'github-template', 'aimdropin')),
  name text not null,
  title text not null,
  description text,
  kind text not null check (kind in ('page', 'section', 'component')),
  purpose text not null check (purpose in ('landing', 'dashboard', 'auth', 'ecommerce', 'blog', 'docs', 'general')),
  registry_type text,
  stack text check (stack in ('react-tsx', 'react-jsx', 'html')),
  framework text check (framework in ('next', 'react', 'astro', 'html')),
  dependencies text[] not null default '{}',
  registry_dependencies text[] not null default '{}',
  heavy_deps text[] not null default '{}',
  categories text[] not null default '{}',
  -- { spdx, url, verifiedAt, freeOnly, textHash? } - spdx must be on the
  -- same allowlist as scripts/catalog/license.mjs.
  license jsonb not null check (
    license ->> 'spdx' in ('MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD', 'Unlicense', 'CC0-1.0')
  ),
  author text,
  homepage text,
  source_url text not null,
  install jsonb not null,
  preview_status text not null default 'unknown' check (preview_status in ('unknown', 'ok', 'failed')),
  thumb_url text,
  content_hash text,
  indexed_at timestamptz not null,
  search tsvector generated always as (public.catalog_search_doc(title, categories, description)) stored
);

create index catalog_items_search_idx on public.catalog_items using gin (search);
create index catalog_items_kind_purpose_idx on public.catalog_items (kind, purpose);
create index catalog_items_source_idx on public.catalog_items (source_id);

alter table public.catalog_items enable row level security;
create policy "catalog is public" on public.catalog_items for select using (true);

-- ---------------------------------------------------------------------
-- Pages people build and save (private by default)
-- ---------------------------------------------------------------------
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 500),
  -- Where it is listed once published: a whole page, a reusable section,
  -- or a component.
  kind text not null default 'page' check (kind in ('page', 'section', 'component')),
  purpose text not null default 'landing' check (purpose in ('landing', 'dashboard', 'auth', 'ecommerce', 'blog', 'docs', 'general')),
  stack text not null check (stack in ('html', 'jsx')),
  source text not null check (octet_length(source) <= 1048576),
  -- Items the page was built from: [{ id, title, sourceUrl, license }],
  -- kept so MIT notices travel with the page.
  credits jsonb not null default '[]',
  remixed_from uuid references public.pages (id) on delete set null,
  visibility text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  -- Moderation state. Owners can only move draft -> pending_review (via
  -- submit_page); the checker or a moderator sets published/rejected.
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'published', 'rejected')),
  tier text not null default 'community' check (tier in ('community', 'featured')),
  -- Community pages must be shareable: owners confirm they own the work
  -- and license it under MIT when they submit.
  license text not null default 'MIT' check (license = 'MIT'),
  thumb_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index pages_owner_idx on public.pages (owner_id);
create index pages_listing_idx on public.pages (status, visibility, kind, purpose);

alter table public.pages enable row level security;

create policy "published public pages are listed, owners see their own" on public.pages
  for select using (
    (status = 'published' and visibility in ('public', 'unlisted'))
    or auth.uid() = owner_id
  );
create policy "users create their own pages" on public.pages
  for insert with check (auth.uid() = owner_id and status = 'draft' and tier = 'community');
create policy "users edit their own pages" on public.pages
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "users delete their own pages" on public.pages
  for delete using (auth.uid() = owner_id);

-- Owners can't promote themselves: status, tier and published_at only
-- change through submit_page() or the service role. Any edit to the
-- source of a published page sends it back for review.
create function public.guard_page_update() returns trigger
language plpgsql as $$
begin
  -- The indexer/checker (service role) and security-definer functions
  -- like submit_page() run as privileged roles and may change anything.
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    new.updated_at := now();
    return new;
  end if;
  if new.tier is distinct from old.tier or new.published_at is distinct from old.published_at then
    raise exception 'tier and published_at are set by moderation';
  end if;
  if new.status is distinct from old.status
     and not (old.status in ('draft', 'rejected') and new.status = 'draft') then
    raise exception 'status changes go through submit_page()';
  end if;
  if old.status = 'published' and new.source is distinct from old.source then
    new.status := 'pending_review';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger pages_guard before update on public.pages
  for each row execute function public.guard_page_update();

-- Owner submits a page for the automated checks.
create function public.submit_page(page_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.pages
     set status = 'pending_review'
   where id = page_id
     and owner_id = auth.uid()
     and status in ('draft', 'rejected')
     and visibility <> 'private';
  if not found then
    raise exception 'page not found, not yours, private, or already submitted';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Usage events (views, copies, installs, remixes, exports)
-- Append-only; written only through track_event().
-- ---------------------------------------------------------------------
create table public.events (
  id bigint generated always as identity primary key,
  target_type text not null check (target_type in ('catalog', 'page')),
  target_id text not null,
  event text not null check (event in ('view', 'copy', 'install', 'remix', 'export')),
  user_id uuid references auth.users (id) on delete set null,
  -- Random per-browser id for signed-out visitors; never an IP.
  anon_id text check (char_length(anon_id) <= 64),
  day date not null default current_date,
  created_at timestamptz not null default now()
);

-- One counted event of each kind per visitor per item per day, so
-- repeat clicks can't inflate the ranking.
create unique index events_dedupe_idx on public.events
  (target_type, target_id, event, coalesce(user_id::text, anon_id), day);
create index events_target_idx on public.events (target_type, target_id, event);

alter table public.events enable row level security;
-- No policies: nobody reads or writes events directly.

-- ---------------------------------------------------------------------
-- Stars and ratings
-- ---------------------------------------------------------------------
create table public.stars (
  user_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('catalog', 'page')),
  target_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

alter table public.stars enable row level security;
create policy "stars are public" on public.stars for select using (true);
create policy "users star as themselves" on public.stars
  for insert with check (auth.uid() = user_id);
create policy "users unstar their own" on public.stars
  for delete using (auth.uid() = user_id);

create table public.ratings (
  user_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('catalog', 'page')),
  target_id text not null,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

-- Only people who actually used an item (copied, installed, remixed or
-- exported it) may rate it.
create function public.has_used(t_type text, t_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.events
     where target_type = t_type and target_id = t_id
       and user_id = auth.uid()
       and event in ('copy', 'install', 'remix', 'export')
  );
$$;

alter table public.ratings enable row level security;
create policy "ratings are public" on public.ratings for select using (true);
create policy "users rate what they used" on public.ratings
  for insert with check (auth.uid() = user_id and public.has_used(target_type, target_id));
create policy "users change their own rating" on public.ratings
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.has_used(target_type, target_id));
create policy "users remove their own rating" on public.ratings
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Per-item counters, maintained by triggers
-- ---------------------------------------------------------------------
create table public.target_stats (
  target_type text not null,
  target_id text not null,
  views bigint not null default 0,
  copies bigint not null default 0,
  installs bigint not null default 0,
  remixes bigint not null default 0,
  exports bigint not null default 0,
  stars bigint not null default 0,
  rating_sum bigint not null default 0,
  rating_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (target_type, target_id)
);

alter table public.target_stats enable row level security;
create policy "stats are public" on public.target_stats for select using (true);

create function public.bump_stat(t_type text, t_id text, col text, delta bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if col not in ('views', 'copies', 'installs', 'remixes', 'exports', 'stars', 'rating_sum', 'rating_count') then
    raise exception 'unknown stat %', col;
  end if;
  insert into public.target_stats (target_type, target_id) values (t_type, t_id)
    on conflict do nothing;
  execute format(
    'update public.target_stats set %I = greatest(%I + $1, 0), updated_at = now() where target_type = $2 and target_id = $3',
    col, col
  ) using delta, t_type, t_id;
end;
$$;

create function public.on_event_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.bump_stat(new.target_type, new.target_id,
    case new.event
      when 'view' then 'views' when 'copy' then 'copies' when 'install' then 'installs'
      when 'remix' then 'remixes' else 'exports'
    end, 1);
  return new;
end;
$$;
create trigger events_stats after insert on public.events
  for each row execute function public.on_event_insert();

create function public.on_star_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.bump_stat(new.target_type, new.target_id, 'stars', 1);
  else
    perform public.bump_stat(old.target_type, old.target_id, 'stars', -1);
  end if;
  return null;
end;
$$;
create trigger stars_stats after insert or delete on public.stars
  for each row execute function public.on_star_change();

create function public.on_rating_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.bump_stat(old.target_type, old.target_id, 'rating_sum', -old.score);
    perform public.bump_stat(old.target_type, old.target_id, 'rating_count', -1);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.bump_stat(new.target_type, new.target_id, 'rating_sum', new.score);
    perform public.bump_stat(new.target_type, new.target_id, 'rating_count', 1);
  end if;
  return null;
end;
$$;
create trigger ratings_stats after insert or update or delete on public.ratings
  for each row execute function public.on_rating_change();

-- Record a usage event. Signed-out visitors pass a random anon_id.
-- Repeats on the same day are ignored by the dedupe index.
create function public.track_event(t_type text, t_id text, ev text, anon text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null and (anon is null or char_length(anon) < 8) then
    raise exception 'signed-out events need an anon id';
  end if;
  insert into public.events (target_type, target_id, event, user_id, anon_id)
  values (t_type, t_id, ev, auth.uid(), case when auth.uid() is null then anon end)
  on conflict do nothing;
end;
$$;

grant execute on function public.track_event(text, text, text, text) to anon, authenticated;
grant execute on function public.submit_page(uuid) to authenticated;
revoke execute on function public.bump_stat(text, text, text, bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Ranking. What people do counts more than what they look at: a remix or
-- an install is a much stronger signal than a view. Stars and ratings
-- add on top, and newer items get a small boost so the list moves.
-- ---------------------------------------------------------------------
create view public.ranked_targets with (security_invoker = true) as
select
  s.target_type,
  s.target_id,
  s.views, s.copies, s.installs, s.remixes, s.exports, s.stars,
  case when s.rating_count > 0 then round(s.rating_sum::numeric / s.rating_count, 2) end as rating,
  s.rating_count,
  (s.views * 0.05 + s.copies * 1 + s.installs * 2 + s.exports * 2 + s.remixes * 3 + s.stars * 2
    + case when s.rating_count >= 3 then (s.rating_sum::numeric / s.rating_count - 3) * 2 else 0 end
  ) as score
from public.target_stats s;

-- ---------------------------------------------------------------------
-- Reports (copied paid templates, broken or harmful pages)
-- ---------------------------------------------------------------------
create table public.reports (
  id bigint generated always as identity primary key,
  target_type text not null check (target_type in ('catalog', 'page')),
  target_id text not null,
  reason text not null check (reason in ('copyright', 'license', 'malicious', 'broken', 'other')),
  details text check (char_length(details) <= 2000),
  reporter_id uuid references auth.users (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;
create policy "signed-in users can report" on public.reports
  for insert with check (auth.uid() = reporter_id);
