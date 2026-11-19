-- Grind : le social. Profil public (@pseudo), abonnements (demandes à accepter pour un compte privé),
-- stories de 24 h, messages privés entre personnes qui se suivent mutuellement, blocages, signalements.
-- À exécuter une fois dans Supabase (SQL Editor → coller ce fichier → Run), après la première migration.
--
-- Tout passe par les règles d'accès (RLS) et des fonctions qui ne répondent que pour la personne
-- connectée : on ne voit que ce qu'on a le droit de voir, on ne peut écrire qu'en son nom.
-- Jamais de poids, de mesures, de calories du jour ni de photos : seulement ce qu'on choisit de partager
-- (cartes de séance, record, rang, série, recette, programme, exercice, texte).
--
-- Modération (tableau de bord Supabase → SQL Editor) :
--   select * from public.reports order by created_at desc;                       -- signalements
--   update public.social_profiles set banned = true where handle = 'pseudo';     -- bannir
--   delete from public.stories where id = '…';  delete from public.messages where id = '…';

-- ============================================================================
-- Profils sociaux
-- ============================================================================
create table if not exists public.social_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- 3 à 20 caractères : lettres minuscules, chiffres, « _ » et « . » (pas au début ni à la fin pour le point)
  handle text not null unique check (handle ~ '^[a-z0-9_][a-z0-9_.]{1,18}[a-z0-9_]$'),
  name text not null default '' check (char_length(name) <= 40),
  color smallint not null default 0 check (color between 0 and 7),
  bio text not null default '' check (char_length(bio) <= 160),
  is_public boolean not null default false,
  -- carte publique : rang, niveau, série, séances (jamais de poids ni de calories)
  stats jsonb not null default '{}'::jsonb check (jsonb_typeof(stats) = 'object' and octet_length(stats::text) <= 2000),
  rules_at timestamptz not null default now(),    -- règles de la communauté acceptées
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.social_profiles enable row level security;
revoke all on public.social_profiles from anon, authenticated;
grant select on public.social_profiles to authenticated;
grant insert (handle, name, color, bio, is_public, stats) on public.social_profiles to authenticated;
grant update (handle, name, color, bio, is_public, stats, rules_at) on public.social_profiles to authenticated;
grant delete on public.social_profiles to authenticated;

drop policy if exists "social : profils visibles" on public.social_profiles;
create policy "social : profils visibles" on public.social_profiles for select to authenticated
  using (not banned or user_id = (select auth.uid()));
drop policy if exists "social : créer son profil" on public.social_profiles;
create policy "social : créer son profil" on public.social_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "social : modifier son profil" on public.social_profiles;
create policy "social : modifier son profil" on public.social_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "social : quitter le social" on public.social_profiles;
create policy "social : quitter le social" on public.social_profiles for delete to authenticated
  using (user_id = (select auth.uid()));

-- pseudos réservés ; date de modification ; passer en public accepte les demandes en attente
create or replace function public.social_profiles_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.handle in ('grind', 'admin', 'support', 'moderation', 'moderateur', 'officiel', 'ren', 'aya', 'coach', 'staff', 'equipe')
     and (tg_op = 'INSERT' or new.handle is distinct from old.handle) then
    raise exception 'pseudo réservé' using errcode = '23514';
  end if;
  new.name := btrim(new.name);
  new.bio := btrim(new.bio);
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    if new.is_public and not old.is_public then
      update public.follows set status = 'accepted' where followee = new.user_id and status = 'pending';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists social_profiles_guard on public.social_profiles;
create trigger social_profiles_guard before insert or update on public.social_profiles
  for each row execute function public.social_profiles_guard();

-- ============================================================================
-- Abonnements : « je suis » quelqu'un ; compte privé : demande en attente jusqu'à son accord
-- ============================================================================
create table if not exists public.follows (
  follower uuid not null default auth.uid() references public.social_profiles (user_id) on delete cascade,
  followee uuid not null references public.social_profiles (user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
create index if not exists follows_followee on public.follows (followee, status);
alter table public.follows enable row level security;
revoke all on public.follows from anon, authenticated;
grant select, delete on public.follows to authenticated;
grant insert (followee) on public.follows to authenticated;
grant update (status) on public.follows to authenticated;

drop policy if exists "social : mes abonnements" on public.follows;
create policy "social : mes abonnements" on public.follows for select to authenticated
  using (follower = (select auth.uid()) or followee = (select auth.uid()));
drop policy if exists "social : suivre" on public.follows;
create policy "social : suivre" on public.follows for insert to authenticated
  with check (follower = (select auth.uid()));
-- seule la personne suivie accepte une demande
drop policy if exists "social : accepter" on public.follows;
create policy "social : accepter" on public.follows for update to authenticated
  using (followee = (select auth.uid())) with check (followee = (select auth.uid()) and status = 'accepted');
-- ne plus suivre, annuler sa demande, refuser une demande, retirer un abonné
drop policy if exists "social : arrêter" on public.follows;
create policy "social : arrêter" on public.follows for delete to authenticated
  using (follower = (select auth.uid()) or followee = (select auth.uid()));

-- ============================================================================
-- Blocages : plus d'abonnement dans un sens ni dans l'autre, plus de messages, plus de stories
-- ============================================================================
create table if not exists public.blocks (
  blocker uuid not null default auth.uid() references public.social_profiles (user_id) on delete cascade,
  blocked uuid not null references public.social_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;
grant select, delete on public.blocks to authenticated;
grant insert (blocked) on public.blocks to authenticated;
drop policy if exists "social : mes blocages" on public.blocks;
create policy "social : mes blocages" on public.blocks for all to authenticated
  using (blocker = (select auth.uid())) with check (blocker = (select auth.uid()));

-- ============================================================================
-- Ce que la personne connectée peut faire avec quelqu'un (ne répondent que pour elle)
-- ============================================================================
create or replace function public.social_blocked_with(p_other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks
    where (blocker = (select auth.uid()) and blocked = p_other) or (blocker = p_other and blocked = (select auth.uid())))
$$;
create or replace function public.social_i_follow(p_other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.follows where follower = (select auth.uid()) and followee = p_other and status = 'accepted')
$$;
create or replace function public.social_active(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.social_profiles where user_id = p_user and not banned)
$$;
-- messages : on se suit l'un l'autre, personne n'a bloqué l'autre, aucun des deux n'est banni
create or replace function public.social_can_dm(p_other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and p_other <> (select auth.uid())
    and public.social_i_follow(p_other)
    and exists (select 1 from public.follows where follower = p_other and followee = (select auth.uid()) and status = 'accepted')
    and not public.social_blocked_with(p_other)
    and public.social_active((select auth.uid())) and public.social_active(p_other)
$$;

-- suivre : accepté d'office pour un compte public, en attente sinon ; refusé en cas de blocage
create or replace function public.follows_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare pub boolean;
begin
  if public.social_blocked_with(new.followee) then raise exception 'blocage' using errcode = '42501'; end if;
  if not public.social_active(new.follower) then raise exception 'compte suspendu' using errcode = '42501'; end if;
  select is_public into pub from public.social_profiles where user_id = new.followee and not banned;
  if pub is null then raise exception 'profil introuvable' using errcode = '23503'; end if;
  if (select count(*) from public.follows where follower = new.follower and created_at > now() - interval '1 day') >= 200 then
    raise exception 'trop d''abonnements aujourd''hui' using errcode = '54000';
  end if;
  new.status := case when pub then 'accepted' else 'pending' end;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists follows_before_insert on public.follows;
create trigger follows_before_insert before insert on public.follows
  for each row execute function public.follows_before_insert();

create or replace function public.blocks_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.follows where (follower = new.blocker and followee = new.blocked) or (follower = new.blocked and followee = new.blocker);
  return new;
end $$;
drop trigger if exists blocks_after_insert on public.blocks;
create trigger blocks_after_insert after insert on public.blocks
  for each row execute function public.blocks_after_insert();

-- ============================================================================
-- Stories : une carte, visible 24 h par ses abonnés
-- ============================================================================
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.social_profiles (user_id) on delete cascade,
  kind text not null check (kind in ('seance', 'record', 'rang', 'serie', 'recette', 'programme', 'exercice', 'texte')),
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 20000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index if not exists stories_user on public.stories (user_id, created_at desc);
alter table public.stories enable row level security;
revoke all on public.stories from anon, authenticated;
grant select, delete on public.stories to authenticated;
grant insert (kind, data) on public.stories to authenticated;

drop policy if exists "social : voir les stories" on public.stories;
create policy "social : voir les stories" on public.stories for select to authenticated
  using (user_id = (select auth.uid())
    or (expires_at > now() and public.social_i_follow(user_id) and not public.social_blocked_with(user_id) and public.social_active(user_id)));
drop policy if exists "social : publier" on public.stories;
create policy "social : publier" on public.stories for insert to authenticated
  with check (user_id = (select auth.uid()) and public.social_active((select auth.uid())));
drop policy if exists "social : retirer sa story" on public.stories;
create policy "social : retirer sa story" on public.stories for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.stories_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.stories where user_id = new.user_id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'trop de stories aujourd''hui' using errcode = '54000';
  end if;
  -- ménage : les stories finies depuis plus d'un jour, de tout le monde (elles ne sont plus visibles
  -- depuis leur fin ; ici elles quittent aussi la base)
  delete from public.stories where expires_at < now() - interval '1 day';
  new.created_at := now();
  new.expires_at := now() + interval '24 hours';
  return new;
end $$;
drop trigger if exists stories_before_insert on public.stories;
create trigger stories_before_insert before insert on public.stories
  for each row execute function public.stories_before_insert();

-- ============================================================================
-- Messages privés
-- ============================================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null default auth.uid() references public.social_profiles (user_id) on delete cascade,
  recipient uuid not null references public.social_profiles (user_id) on delete cascade,
  kind text not null default 'texte' check (kind in ('texte', 'carte', 'reaction')),
  body text not null default '' check (char_length(body) <= 2000),
  data jsonb check (data is null or (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 30000)),
  story_id uuid,                                  -- réponse à une story (elle peut avoir disparu depuis)
  created_at timestamptz not null default now(),
  read_at timestamptz,
  deleted boolean not null default false,
  check (sender <> recipient)
);
create index if not exists messages_pair on public.messages (sender, recipient, created_at desc);
create index if not exists messages_to on public.messages (recipient, read_at, created_at desc);
alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
grant insert (recipient, kind, body, data, story_id) on public.messages to authenticated;

drop policy if exists "social : mes messages" on public.messages;
create policy "social : mes messages" on public.messages for select to authenticated
  using (sender = (select auth.uid()) or recipient = (select auth.uid()));
drop policy if exists "social : écrire" on public.messages;
create policy "social : écrire" on public.messages for insert to authenticated
  with check (sender = (select auth.uid()) and public.social_can_dm(recipient));

create or replace function public.messages_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.messages where sender = new.sender and created_at > now() - interval '10 minutes') >= 120 then
    raise exception 'trop de messages, réessaie dans quelques minutes' using errcode = '54000';
  end if;
  new.body := btrim(new.body);
  if new.kind = 'texte' and new.body = '' then raise exception 'message vide' using errcode = '23514'; end if;
  if new.kind = 'carte' and new.data is null then raise exception 'carte vide' using errcode = '23514'; end if;
  new.created_at := now();
  new.read_at := null;
  new.deleted := false;
  return new;
end $$;
drop trigger if exists messages_before_insert on public.messages;
create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

-- ============================================================================
-- Signalements (lus par l'administrateur seulement)
-- ============================================================================
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_user uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('profil', 'story', 'message')),
  target_id text check (target_id is null or char_length(target_id) <= 80),
  reason text not null check (reason in ('harcelement', 'haine', 'sexuel', 'spam', 'danger', 'mineur', 'autre')),
  note text not null default '' check (char_length(note) <= 500),
  snapshot jsonb check (snapshot is null or octet_length(snapshot::text) <= 30000),   -- copie du contenu signalé
  status text not null default 'nouveau' check (status in ('nouveau', 'traite', 'rejete')),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant insert (target_user, kind, target_id, reason, note, snapshot) on public.reports to authenticated;
drop policy if exists "social : signaler" on public.reports;
create policy "social : signaler" on public.reports for insert to authenticated
  with check (reporter = (select auth.uid()));

create or replace function public.reports_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.reports where reporter = new.reporter and created_at > now() - interval '1 day') >= 20 then
    raise exception 'trop de signalements aujourd''hui' using errcode = '54000';
  end if;
  new.created_at := now();
  new.status := 'nouveau';
  return new;
end $$;
drop trigger if exists reports_before_insert on public.reports;
create trigger reports_before_insert before insert on public.reports
  for each row execute function public.reports_before_insert();

-- ============================================================================
-- Lectures pour l'app (une requête par écran)
-- ============================================================================
-- Recherche par pseudo (début) ou par nom (contenu), sans les comptes bloqués ni bannis
create or replace function public.social_search(p_q text)
returns table (id uuid, handle text, name text, color smallint, is_public boolean, i_follow text, follows_me text)
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); q text; pat text;
begin
  if me is null then raise exception 'non connecté' using errcode = '28000'; end if;
  q := lower(btrim(coalesce(p_q, '')));
  q := ltrim(q, '@');
  if char_length(q) < 2 then return; end if;
  pat := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  return query
    select p.user_id, p.handle, p.name, p.color, p.is_public,
      coalesce((select f.status from public.follows f where f.follower = me and f.followee = p.user_id), 'none'),
      coalesce((select f.status from public.follows f where f.follower = p.user_id and f.followee = me), 'none')
    from public.social_profiles p
    where not p.banned and p.user_id <> me and not public.social_blocked_with(p.user_id)
      and (p.handle like pat || '%' or lower(p.name) like '%' || pat || '%')
    order by (p.handle = q) desc, (p.handle like pat || '%') desc, p.handle
    limit 20;
end $$;

-- Fiche d'un profil : ce qu'on a le droit d'en voir
create or replace function public.social_profile(p_handle text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); p public.social_profiles; i_f text; they_f text; can_see boolean;
begin
  if me is null then raise exception 'non connecté' using errcode = '28000'; end if;
  select * into p from public.social_profiles where handle = lower(ltrim(btrim(coalesce(p_handle, '')), '@'));
  if not found or (p.banned and p.user_id <> me) or public.social_blocked_with(p.user_id) then return null; end if;
  select status into i_f from public.follows where follower = me and followee = p.user_id;
  select status into they_f from public.follows where follower = p.user_id and followee = me;
  can_see := p.user_id = me or p.is_public or i_f = 'accepted';
  return jsonb_build_object(
    'id', p.user_id, 'handle', p.handle, 'name', p.name, 'color', p.color, 'bio', p.bio, 'public', p.is_public,
    'stats', case when can_see then p.stats else null end,
    'followers', (select count(*) from public.follows where followee = p.user_id and status = 'accepted'),
    'following', (select count(*) from public.follows where follower = p.user_id and status = 'accepted'),
    'me', p.user_id = me, 'i_follow', coalesce(i_f, 'none'), 'follows_me', coalesce(they_f, 'none'),
    'can_dm', public.social_can_dm(p.user_id),
    'stories', case when can_see then (select count(*) from public.stories s where s.user_id = p.user_id and s.expires_at > now()) else 0 end);
end $$;

-- Les gens avec qui on a un lien : abonnements, abonnés, demandes (dans les deux sens)
create or replace function public.social_people()
returns table (id uuid, handle text, name text, color smallint, is_public boolean, i_follow text, follows_me text, since timestamptz)
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as id),
  rel as (
    select f.followee as id, f.created_at from public.follows f, me where f.follower = me.id
    union all
    select f.follower, f.created_at from public.follows f, me where f.followee = me.id
  )
  select p.user_id, p.handle, p.name, p.color, p.is_public,
    coalesce((select f.status from public.follows f, me where f.follower = me.id and f.followee = p.user_id), 'none'),
    coalesce((select f.status from public.follows f, me where f.follower = p.user_id and f.followee = me.id), 'none'),
    max(rel.created_at)
  from rel join public.social_profiles p on p.user_id = rel.id
  where not p.banned and not public.social_blocked_with(p.user_id)
  group by p.user_id, p.handle, p.name, p.color, p.is_public
  order by max(rel.created_at) desc
  limit 500
$$;

create or replace function public.social_blocked()
returns table (id uuid, handle text, name text, color smallint, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.handle, p.name, p.color, b.created_at
  from public.blocks b join public.social_profiles p on p.user_id = b.blocked
  where b.blocker = (select auth.uid())
  order by b.created_at desc
$$;

-- Stories visibles (les siennes et celles des comptes suivis), de la plus ancienne à la plus récente
create or replace function public.social_stories()
returns table (id uuid, user_id uuid, handle text, name text, color smallint, kind text, data jsonb, created_at timestamptz, expires_at timestamptz, mine boolean)
language sql stable security invoker set search_path = '' as $$
  select s.id, s.user_id, p.handle, p.name, p.color, s.kind, s.data, s.created_at, s.expires_at, s.user_id = (select auth.uid())
  from public.stories s join public.social_profiles p on p.user_id = s.user_id
  where s.expires_at > now()
  order by s.created_at
  limit 300
$$;

-- Conversations : dernier message, non lus, peut-on encore écrire
create or replace function public.social_inbox()
returns table (other uuid, handle text, name text, color smallint, last_at timestamptz, last_kind text, last_body text, last_mine boolean, last_deleted boolean, unread int, can_dm boolean)
language sql stable security invoker set search_path = '' as $$
  with mine as (
    select case when m.sender = (select auth.uid()) then m.recipient else m.sender end as other,
      m.created_at, m.kind, m.body, m.deleted, m.sender = (select auth.uid()) as mine
    from public.messages m
  ), last as (
    select distinct on (other) other, created_at, kind, body, deleted, mine from mine order by other, created_at desc
  ), unread as (
    select m.sender as other, count(*)::int as n from public.messages m
    where m.recipient = (select auth.uid()) and m.read_at is null and not m.deleted group by m.sender
  )
  select l.other, p.handle, p.name, p.color, l.created_at, l.kind,
    case when l.deleted then '' else left(l.body, 140) end, l.mine, l.deleted, coalesce(u.n, 0), public.social_can_dm(l.other)
  from last l join public.social_profiles p on p.user_id = l.other
  left join unread u on u.other = l.other
  where not public.social_blocked_with(l.other)
  order by l.created_at desc
  limit 100
$$;

-- Une conversation : les derniers messages, dans l'ordre
create or replace function public.social_thread(p_other uuid, p_limit int default 80)
returns table (id uuid, mine boolean, kind text, body text, data jsonb, story_id uuid, created_at timestamptz, read_at timestamptz, deleted boolean)
language sql stable security invoker set search_path = '' as $$
  select t.id, t.mine, t.kind, t.body, t.data, t.story_id, t.created_at, t.read_at, t.deleted from (
    select m.id, m.sender = (select auth.uid()) as mine, m.kind,
      case when m.deleted then '' else m.body end as body, case when m.deleted then null else m.data end as data,
      m.story_id, m.created_at, m.read_at, m.deleted
    from public.messages m
    where (m.sender = (select auth.uid()) and m.recipient = p_other) or (m.sender = p_other and m.recipient = (select auth.uid()))
    order by m.created_at desc
    limit least(greatest(coalesce(p_limit, 80), 1), 200)
  ) t order by t.created_at
$$;

create or replace function public.social_mark_read(p_other uuid)
returns int language sql volatile security definer set search_path = '' as $$
  with u as (
    update public.messages set read_at = now()
    where recipient = (select auth.uid()) and sender = p_other and read_at is null
    returning 1
  ) select count(*)::int from u
$$;

-- Retirer un de ses messages (« message supprimé » des deux côtés)
create or replace function public.social_delete_message(p_id uuid)
returns boolean language sql volatile security definer set search_path = '' as $$
  with u as (
    update public.messages set deleted = true, body = '', data = null
    where id = p_id and sender = (select auth.uid())
    returning 1
  ) select exists (select 1 from u)
$$;

-- Pastilles : messages non lus, demandes en attente, stories publiées depuis p_seen
create or replace function public.social_badges(p_seen timestamptz default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'unread', (select count(*) from public.messages m where m.recipient = (select auth.uid()) and m.read_at is null and not m.deleted
                 and not public.social_blocked_with(m.sender)),
    'requests', (select count(*) from public.follows f where f.followee = (select auth.uid()) and f.status = 'pending'),
    'stories', (select count(*) from public.stories s where s.user_id <> (select auth.uid()) and s.expires_at > now()
                 and (p_seen is null or s.created_at > p_seen)))
$$;

-- Droits sur les fonctions : comptes connectés seulement
do $$
declare f text;
begin
  foreach f in array array[
    'social_blocked_with(uuid)', 'social_i_follow(uuid)', 'social_active(uuid)', 'social_can_dm(uuid)',
    'social_search(text)', 'social_profile(text)', 'social_people()', 'social_blocked()', 'social_stories()',
    'social_inbox()', 'social_thread(uuid, int)', 'social_mark_read(uuid)', 'social_delete_message(uuid)', 'social_badges(timestamptz)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array[
    'social_profiles_guard()', 'follows_before_insert()', 'blocks_after_insert()', 'stories_before_insert()',
    'messages_before_insert()', 'reports_before_insert()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
