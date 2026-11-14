-- MON-SUIVI : comptes, synchronisation des données, photos, quota d'analyses IA.
-- À exécuter une fois dans Supabase (SQL Editor, ou `supabase db push`).
-- Chaque utilisateur ne voit et ne modifie que ses propres lignes (RLS).

-- ============================================================================
-- Profils : offre (free / pro / pro_plus) et consentement
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'pro_plus')),
  consent_version text,
  consent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profil : lecture de son profil" on public.profiles;
create policy "profil : lecture de son profil" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
-- Pas d'écriture directe : l'offre se change côté administrateur (plus tard : paiement).
revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Consentement donné à la connexion (version du texte affiché + date)
create or replace function public.record_consent(p_version text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'non connecté' using errcode = '28000'; end if;
  insert into public.profiles (id, consent_version, consent_at)
  values (auth.uid(), left(coalesce(p_version, ''), 40), now())
  on conflict (id) do update set consent_version = excluded.consent_version, consent_at = excluded.consent_at;
end $$;

-- ============================================================================
-- Données synchronisées : une ligne par clé de l'app (semaine, mesures, aliments…)
-- ============================================================================
create sequence if not exists public.sync_rev_seq;
grant usage on sequence public.sync_rev_seq to authenticated, service_role;
revoke all on sequence public.sync_rev_seq from anon;

create table if not exists public.kv (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 200),
  value text check (value is null or octet_length(value) <= 2000000),
  deleted boolean not null default false,
  rev bigint not null default nextval('public.sync_rev_seq'),
  t bigint not null default 0,                    -- heure de la modification sur l'appareil (ms)
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
create index if not exists kv_user_rev on public.kv (user_id, rev);
alter table public.kv enable row level security;
drop policy if exists "kv : lecture" on public.kv;
drop policy if exists "kv : ajout" on public.kv;
drop policy if exists "kv : modification" on public.kv;
create policy "kv : lecture" on public.kv for select to authenticated using (user_id = (select auth.uid()));
create policy "kv : ajout" on public.kv for insert to authenticated with check (user_id = (select auth.uid()));
create policy "kv : modification" on public.kv for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.kv from anon;
revoke delete, truncate on public.kv from authenticated;

-- Révision et date toujours fixées par le serveur
create or replace function public.sync_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.rev := nextval('public.sync_rev_seq');
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists kv_touch on public.kv;
create trigger kv_touch before insert or update on public.kv for each row execute function public.sync_touch();

-- Envoi groupé avec contrôle de version : une valeur n'est acceptée que si l'appareil
-- connaissait la dernière révision (base_rev). Sinon on lui renvoie la version du serveur
-- (« conflict ») : il fusionne et renvoie.
--   items : [{ key, value, deleted, base_rev, t }]  →  [{ key, status: ok|conflict, rev | row }]
create or replace function public.kv_push(items jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  it jsonb;
  k text;
  base bigint;
  del boolean;
  cur public.kv%rowtype;
  res jsonb := '[]'::jsonb;
begin
  if uid is null then raise exception 'non connecté' using errcode = '28000'; end if;
  if jsonb_typeof(items) is distinct from 'array' then raise exception 'items : liste attendue' using errcode = '22023'; end if;
  if jsonb_array_length(items) > 200 then raise exception 'au plus 200 éléments par envoi' using errcode = '22023'; end if;
  for it in select e from jsonb_array_elements(items) as e loop
    k := it ->> 'key';
    if k is null then raise exception 'clé manquante' using errcode = '22023'; end if;
    base := coalesce((it ->> 'base_rev')::bigint, 0);
    del := coalesce((it ->> 'deleted')::boolean, false);
    select * into cur from public.kv where user_id = uid and key = k for update;
    if not found then
      if base <> 0 then
        res := res || jsonb_build_array(jsonb_build_object('key', k, 'status', 'conflict', 'row', null));
        continue;
      end if;
      insert into public.kv (user_id, key, value, deleted, t)
      values (uid, k, case when del then null else it ->> 'value' end, del, coalesce((it ->> 't')::bigint, 0))
      on conflict (user_id, key) do nothing
      returning * into cur;
      if not found then   -- ajoutée au même moment par un autre envoi
        select * into cur from public.kv where user_id = uid and key = k;
        res := res || jsonb_build_array(jsonb_build_object('key', k, 'status', 'conflict', 'row',
          jsonb_build_object('value', cur.value, 'deleted', cur.deleted, 'rev', cur.rev, 't', cur.t, 'updated_at', cur.updated_at)));
      else
        res := res || jsonb_build_array(jsonb_build_object('key', k, 'status', 'ok', 'rev', cur.rev));
      end if;
    elsif cur.rev <> base then
      res := res || jsonb_build_array(jsonb_build_object('key', k, 'status', 'conflict', 'row',
        jsonb_build_object('value', cur.value, 'deleted', cur.deleted, 'rev', cur.rev, 't', cur.t, 'updated_at', cur.updated_at)));
    else
      update public.kv set value = case when del then null else it ->> 'value' end, deleted = del, t = coalesce((it ->> 't')::bigint, 0)
      where user_id = uid and key = k
      returning * into cur;
      res := res || jsonb_build_array(jsonb_build_object('key', k, 'status', 'ok', 'rev', cur.rev));
    end if;
  end loop;
  return res;
end $$;

-- ============================================================================
-- Photos de progression (seulement si l'utilisateur active leur sauvegarde)
-- ============================================================================
create table if not exists public.photos (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (id ~ '^p[0-9a-z]{6,40}$'),
  d text not null check (d ~ '^\d{4}-\d{2}-\d{2}$'),
  bytes integer not null default 0 check (bytes between 0 and 10000000),
  deleted boolean not null default false,
  rev bigint not null default nextval('public.sync_rev_seq'),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists photos_user_rev on public.photos (user_id, rev);
alter table public.photos enable row level security;
drop policy if exists "photos : lecture" on public.photos;
drop policy if exists "photos : ajout" on public.photos;
drop policy if exists "photos : modification" on public.photos;
drop policy if exists "photos : suppression" on public.photos;
create policy "photos : lecture" on public.photos for select to authenticated using (user_id = (select auth.uid()));
create policy "photos : ajout" on public.photos for insert to authenticated with check (user_id = (select auth.uid()));
create policy "photos : modification" on public.photos for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "photos : suppression" on public.photos for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.photos from anon;
drop trigger if exists photos_touch on public.photos;
create trigger photos_touch before insert or update on public.photos for each row execute function public.sync_touch();

-- Arrêt de la sauvegarde des photos : on oublie tout côté serveur (les fichiers sont
-- supprimés par l'app via l'API de stockage).
create or replace function public.photos_purge()
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'non connecté' using errcode = '28000'; end if;
  delete from public.photos where user_id = auth.uid();
end $$;

-- Fichiers : bucket privé, un dossier par utilisateur (photos/<id utilisateur>/<id photo>.jpg)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "photos : lire ses fichiers" on storage.objects;
drop policy if exists "photos : ajouter ses fichiers" on storage.objects;
drop policy if exists "photos : remplacer ses fichiers" on storage.objects;
drop policy if exists "photos : supprimer ses fichiers" on storage.objects;
create policy "photos : lire ses fichiers" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos : ajouter ses fichiers" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos : remplacer ses fichiers" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos : supprimer ses fichiers" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ============================================================================
-- Analyses IA : quota par jour (heure de Paris) selon l'offre
--   free : 3 / jour, pro : 20 / jour, pro_plus : illimité
-- ============================================================================
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
drop policy if exists "ia : lecture de son usage" on public.ai_usage;
create policy "ia : lecture de son usage" on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.ai_usage from anon;
revoke insert, update, delete on public.ai_usage from authenticated;

create or replace function public.plan_ai_limit(p_plan text)
returns integer language sql immutable set search_path = '' as $$
  select case coalesce(p_plan, 'free') when 'free' then 3 when 'pro' then 20 else null end
$$;

create or replace function public.paris_today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Paris')::date
$$;

-- Réserve une analyse. Appelée uniquement par la fonction serveur « ai » (rôle service).
create or replace function public.ai_consume(p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_plan text;
  v_limit integer;
  v_day date := public.paris_today();
  v_count integer;
begin
  insert into public.profiles (id) values (p_user) on conflict (id) do nothing;
  select plan into v_plan from public.profiles where id = p_user;
  v_limit := public.plan_ai_limit(v_plan);
  insert into public.ai_usage as u (user_id, day, count) values (p_user, v_day, 1)
  on conflict (user_id, day) do update set count = u.count + 1
    where v_limit is null or u.count < v_limit
  returning u.count into v_count;
  if v_count is null then
    select count into v_count from public.ai_usage where user_id = p_user and day = v_day;
    return jsonb_build_object('ok', false, 'plan', v_plan, 'limit', v_limit, 'used', v_count, 'day', v_day);
  end if;
  return jsonb_build_object('ok', true, 'plan', v_plan, 'limit', v_limit, 'used', v_count, 'day', v_day);
end $$;

-- Rend une analyse réservée quand l'IA n'a pas répondu (panne, surcharge).
create or replace function public.ai_refund(p_user uuid, p_day date)
returns void language sql security definer set search_path = '' as $$
  update public.ai_usage set count = greatest(count - 1, 0) where user_id = p_user and day = p_day
$$;

-- État du compte pour l'app : offre, analyses utilisées aujourd'hui, limite.
create or replace function public.account_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_plan text;
  v_used integer;
begin
  if auth.uid() is null then raise exception 'non connecté' using errcode = '28000'; end if;
  select plan into v_plan from public.profiles where id = auth.uid();
  v_plan := coalesce(v_plan, 'free');
  select count into v_used from public.ai_usage where user_id = auth.uid() and day = public.paris_today();
  return jsonb_build_object('plan', v_plan, 'ai_used', coalesce(v_used, 0), 'ai_limit', public.plan_ai_limit(v_plan), 'day', public.paris_today());
end $$;

-- ============================================================================
-- Droits d'exécution
-- ============================================================================
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_touch() from public, anon, authenticated;
revoke execute on function public.ai_consume(uuid) from public, anon, authenticated;
revoke execute on function public.ai_refund(uuid, date) from public, anon, authenticated;
grant execute on function public.ai_consume(uuid) to service_role;
grant execute on function public.ai_refund(uuid, date) to service_role;
revoke execute on function public.kv_push(jsonb) from public, anon;
revoke execute on function public.photos_purge() from public, anon;
revoke execute on function public.account_status() from public, anon;
revoke execute on function public.record_consent(text) from public, anon;
grant execute on function public.kv_push(jsonb) to authenticated;
grant execute on function public.photos_purge() to authenticated;
grant execute on function public.account_status() to authenticated;
grant execute on function public.record_consent(text) to authenticated;
