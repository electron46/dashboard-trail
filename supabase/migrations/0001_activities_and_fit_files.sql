-- ELEV — Étape A : table `activities` (une ligne par séance) + stockage privé des fichiers .fit originaux.
-- N'affecte pas la table existante `trail_data` (synchro actuelle) : purement additif.
-- À exécuter une fois dans l'éditeur SQL du tableau de bord Supabase (Database > SQL Editor).

-- ---------------------------------------------------------------------------
-- 1) Table activities : une ligne par séance, au lieu du bloc JSON unique actuel.
-- ---------------------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- identifiant utilisé côté navigateur (localStorage) pour rapprocher une séance
  -- déjà connue en local avec sa ligne côté Supabase, sans dépendre de l'id Supabase.
  client_id text not null,

  date date not null,
  sport text,
  distance_km numeric,
  duration_s integer,
  ascent_m integer,
  descent_m integer,
  avg_hr integer,
  max_hr integer,
  avg_pace_sec_km integer,
  avg_power integer,
  max_power integer,
  avg_temp numeric,
  calories integer,
  cadence_spm integer,
  gear_id text,

  -- Contexte du jour et retour IA déjà saisis dans l'appli (repris tels quels).
  context jsonb,
  ai_feedback jsonb,

  -- Série temporelle affichée dans les graphiques de la séance (allure/FC/altitude/GPS).
  series jsonb,
  laps jsonb,

  -- Tout ce que le parser FIT a lu et n'a pas pu classer dans les colonnes ci-dessus
  -- (champs développeur, messages inconnus, événements...) — jamais silencieusement perdu.
  raw jsonb,

  -- Chemin vers le fichier .fit original dans le bucket de stockage privé "fit-files",
  -- NULL si la séance a été saisie avant cette évolution ou importée sans fichier .fit.
  fit_file_path text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, client_id)
);

create index if not exists activities_user_date_idx on public.activities (user_id, date desc);

alter table public.activities enable row level security;

create policy "activities_select_own" on public.activities
  for select using (auth.uid() = user_id);
create policy "activities_insert_own" on public.activities
  for insert with check (auth.uid() = user_id);
create policy "activities_update_own" on public.activities
  for update using (auth.uid() = user_id);
create policy "activities_delete_own" on public.activities
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2) Stockage privé des fichiers .fit originaux.
--    Convention de chemin : {user_id}/{client_id}.fit
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('fit-files', 'fit-files', false)
on conflict (id) do nothing;

create policy "fit_files_select_own" on storage.objects
  for select using (
    bucket_id = 'fit-files' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "fit_files_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'fit-files' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "fit_files_update_own" on storage.objects
  for update using (
    bucket_id = 'fit-files' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "fit_files_delete_own" on storage.objects
  for delete using (
    bucket_id = 'fit-files' and (storage.foldername(name))[1] = auth.uid()::text
  );
