-- Apvio catalog and private application storage. Safe to re-run on the project.
create table if not exists public.apvio_admin_allowlist (
  email text primary key check (email = lower(email) and char_length(email) <= 254)
);

insert into public.apvio_admin_allowlist(email) values ('lbsxzr@gmail.com')
on conflict (email) do nothing;

create table if not exists public.apvio_apps (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  platform text not null check (platform in ('ios', 'android')),
  category text not null check (category in ('productivity', 'photography', 'personalization', 'tools')),
  version text not null check (char_length(version) between 1 and 40),
  short_description text not null check (char_length(short_description) between 1 and 280),
  description text not null check (char_length(description) between 1 and 5000),
  requirements text not null check (char_length(requirements) <= 250),
  developer text not null check (char_length(developer) <= 120),
  license text not null check (char_length(license) between 1 and 300),
  source_url text not null check (source_url ~ '^https?://[^[:space:]]+$' and char_length(source_url) <= 2048),
  rights_confirmed boolean not null default false,
  file_path text not null unique check (file_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](ipa|apk)$'),
  file_name text not null check (char_length(file_name) between 1 and 180),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 52428800),
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_apps_require_rights check (not is_published or (rights_confirmed and license <> '' and source_url <> ''))
);

alter table public.apvio_apps drop constraint if exists apvio_apps_file_path_check;
alter table public.apvio_apps add constraint apvio_apps_file_path_check
  check (file_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](ipa|apk)$');

alter table public.apvio_admin_allowlist enable row level security;
alter table public.apvio_apps enable row level security;

create or replace function public.apvio_is_admin()
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.apvio_admin_allowlist a
    where lower(a.email) = lower((select auth.jwt() ->> 'email'))
  );
$$;

grant select on public.apvio_admin_allowlist to anon, authenticated;
grant select on public.apvio_apps to anon, authenticated;
grant insert, update, delete on public.apvio_apps to authenticated;

drop policy if exists "admins can read only their own allowlist row" on public.apvio_admin_allowlist;
create policy "admins can read only their own allowlist row" on public.apvio_admin_allowlist
for select to authenticated using (lower(email) = lower((select auth.jwt() ->> 'email')));

drop policy if exists "published apps and admins can view apps" on public.apvio_apps;
create policy "published apps and admins can view apps" on public.apvio_apps
for select to anon, authenticated using (is_published = true or (select public.apvio_is_admin()));

drop policy if exists "admins can insert apps" on public.apvio_apps;
create policy "admins can insert apps" on public.apvio_apps
for insert to authenticated with check ((select public.apvio_is_admin()));

drop policy if exists "admins can update apps" on public.apvio_apps;
create policy "admins can update apps" on public.apvio_apps
for update to authenticated using ((select public.apvio_is_admin())) with check ((select public.apvio_is_admin()));

drop policy if exists "admins can delete apps" on public.apvio_apps;
create policy "admins can delete apps" on public.apvio_apps
for delete to authenticated using ((select public.apvio_is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('apvio-app-files', 'apvio-app-files', false, 52428800,
  array['application/octet-stream', 'application/vnd.android.package-archive', 'application/x-itunes-ipa'])
on conflict (id) do update set public = false, file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins can upload app files" on storage.objects;
create policy "admins can upload app files" on storage.objects for insert to authenticated
with check (bucket_id = 'apvio-app-files' and (select public.apvio_is_admin())
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](ipa|apk)$');

drop policy if exists "admins can update app files" on storage.objects;
create policy "admins can update app files" on storage.objects for update to authenticated
using (bucket_id = 'apvio-app-files' and (select public.apvio_is_admin()))
with check (bucket_id = 'apvio-app-files' and (select public.apvio_is_admin()));

drop policy if exists "admins can delete app files" on storage.objects;
create policy "admins can delete app files" on storage.objects for delete to authenticated
using (bucket_id = 'apvio-app-files' and (select public.apvio_is_admin()));

drop policy if exists "published app files and admins can read" on storage.objects;
create policy "published app files and admins can read" on storage.objects for select to anon, authenticated
using (bucket_id = 'apvio-app-files' and (
  exists (select 1 from public.apvio_apps a where a.file_path = objects.name and a.is_published = true)
  or (select public.apvio_is_admin())
));

