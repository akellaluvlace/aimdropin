-- Gallery ratings, views and community promotion (2026-11-10).
--
-- 1. Landing-page templates ('template', id = slug) and imported dashboards
--    ('dashboard', id = slug) can be viewed, starred, rated and reported like
--    catalog items ('catalog') and community pages ('page', id = uuid).
-- 2. Votes are the 1-5 star rating. Anyone signed in may rate anything once
--    (and change it), except their own pages. The old "only after you used
--    it" rule stopped people voting on community pages they only looked at.
-- 3. ranked_targets gains a Bayesian average (pulls small samples toward the
--    site mean), and community pages with enough good ratings are promoted
--    into the main gallery (promoted_pages).

-- ---------------------------------------------------------------------
-- 1) Target types
-- ---------------------------------------------------------------------
alter table public.events drop constraint if exists events_target_type_check;
alter table public.events add constraint events_target_type_check
  check (target_type in ('catalog', 'page', 'template', 'dashboard'));
alter table public.stars drop constraint if exists stars_target_type_check;
alter table public.stars add constraint stars_target_type_check
  check (target_type in ('catalog', 'page', 'template', 'dashboard'));
alter table public.ratings drop constraint if exists ratings_target_type_check;
alter table public.ratings add constraint ratings_target_type_check
  check (target_type in ('catalog', 'page', 'template', 'dashboard'));
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('catalog', 'page', 'template', 'dashboard'));

-- Target ids are slugs, catalog ids or uuids; keep them bounded.
alter table public.events add constraint events_target_id_len check (char_length(target_id) between 1 and 200);
alter table public.stars add constraint stars_target_id_len check (char_length(target_id) between 1 and 200);
alter table public.ratings add constraint ratings_target_id_len check (char_length(target_id) between 1 and 200);

-- ---------------------------------------------------------------------
-- 2) Who may rate
-- ---------------------------------------------------------------------
-- A page target must be a published, listed page that isn't yours.
create function public.can_rate(t_type text, t_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when t_type = 'page' then exists (
      select 1 from public.pages p
       where p.id::text = t_id
         and p.status = 'published'
         and p.visibility in ('public', 'unlisted')
         and p.owner_id <> auth.uid()
    )
    else true
  end;
$$;

drop policy if exists "users rate what they used" on public.ratings;
drop policy if exists "users change their own rating" on public.ratings;
create policy "signed-in users rate anything but their own pages" on public.ratings
  for insert with check (auth.uid() = user_id and public.can_rate(target_type, target_id));
create policy "users change their own rating" on public.ratings
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.can_rate(target_type, target_id));

grant execute on function public.can_rate(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) Ranking with a Bayesian rating
-- ---------------------------------------------------------------------
-- bayes = (C·m + Σscores) / (C + n): with C = 5 and m = the site-wide mean,
-- one 5-star vote can't beat forty 4.6-star ones.
drop view if exists public.ranked_targets;
create view public.ranked_targets with (security_invoker = true) as
with prior as (
  select coalesce(sum(rating_sum)::numeric / nullif(sum(rating_count), 0), 3.5) as m
    from public.target_stats
)
select
  s.target_type,
  s.target_id,
  s.views, s.copies, s.installs, s.remixes, s.exports, s.stars,
  case when s.rating_count > 0 then round(s.rating_sum::numeric / s.rating_count, 2) end as rating,
  s.rating_count,
  round((5 * prior.m + s.rating_sum) / (5 + s.rating_count), 3) as bayes,
  (s.views * 0.05 + s.copies * 1 + s.installs * 2 + s.exports * 2 + s.remixes * 3 + s.stars * 2
    + ((5 * prior.m + s.rating_sum) / (5 + s.rating_count) - prior.m) * least(s.rating_count, 50) * 0.5
  ) as score
from public.target_stats s cross join prior;

grant select on public.ranked_targets to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) Community listing and promotion
-- ---------------------------------------------------------------------
create index if not exists pages_published_idx on public.pages (published_at desc)
  where status = 'published' and visibility = 'public';

-- Published, listed community pages with their author and stats. Promotion
-- into the main gallery: featured by hand, or 10+ ratings averaging 4.0+
-- (Bayesian). Change the two numbers here to move the bar.
create view public.community_pages with (security_invoker = true) as
select
  p.id, p.title, p.description, p.kind, p.purpose, p.stack, p.thumb_path,
  p.remixed_from, p.tier, p.published_at, p.updated_at,
  pr.username, pr.display_name, pr.avatar_url,
  coalesce(r.views, 0) as views,
  r.rating,
  coalesce(r.rating_count, 0) as rating_count,
  coalesce(r.bayes, 0) as bayes,
  (p.tier = 'featured' or (coalesce(r.rating_count, 0) >= 10 and coalesce(r.bayes, 0) >= 4.0)) as promoted
from public.pages p
join public.profiles pr on pr.id = p.owner_id
left join public.ranked_targets r on r.target_type = 'page' and r.target_id = p.id::text
where p.status = 'published' and p.visibility = 'public';

grant select on public.community_pages to anon, authenticated;
