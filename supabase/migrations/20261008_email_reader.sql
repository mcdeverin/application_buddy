-- Run once in the existing Application Buddy project's SQL Editor.
-- No service-role key is required by the app.
begin;
create table if not exists public.email_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  expires_at timestamptz not null,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  page_token text
);
create table if not exists public.email_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_message_id text not null,
  mailbox_email text not null,
  subject text not null,
  sender text not null,
  excerpt text not null,
  received_at timestamptz not null,
  suggested_company text not null default '',
  suggested_role text not null default '',
  suggested_status text not null default 'Applied',
  reason text not null default '',
  review_status text not null default 'pending' check (review_status in ('pending','applied','ignored')),
  application_id uuid references public.applications(id),
  created_at timestamptz not null default now(),
  unique (user_id, mailbox_email, gmail_message_id)
);
alter table public.email_connections enable row level security;
alter table public.email_imports enable row level security;
drop policy if exists "Own email connections" on public.email_connections;
create policy "Own email connections" on public.email_connections for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Own email imports" on public.email_imports;
create policy "Own email imports" on public.email_imports for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.email_connections, public.email_imports to authenticated;
create index if not exists email_imports_review_idx on public.email_imports(user_id, review_status, received_at desc);

-- Atomic review: update/create application, add event and mark the email processed together.
create or replace function public.accept_email_update(import_id uuid, company_name text, role_name text, new_status text, target_application_id uuid default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare item public.email_imports%rowtype; app_id uuid; matches integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(company_name)) not between 1 and 200 or length(trim(role_name)) not between 1 and 250 then raise exception 'Company and role required'; end if;
  if new_status not in ('Saved','Applied','Screening','Interview','Final','Offer','Rejected','Withdrawn') then raise exception 'Invalid stage'; end if;
  select * into item from public.email_imports where id = import_id and user_id = auth.uid() for update;
  if not found then raise exception 'Email not found'; end if;
  if item.review_status = 'applied' then return item.application_id; end if;
  if item.review_status <> 'pending' then raise exception 'Email is not pending'; end if;
  if target_application_id is not null then
    select id into app_id from public.applications where id = target_application_id and user_id = auth.uid();
    if not found then raise exception 'Application not found'; end if;
  else
    -- Serialize exact company/role matches to avoid concurrent duplicate creation.
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || lower(trim(company_name)) || ':' || lower(trim(role_name)), 0));
    select count(*) into matches from public.applications where user_id = auth.uid() and lower(company) = lower(trim(company_name)) and lower(role) = lower(trim(role_name));
    if matches > 1 then raise exception 'Choose the existing application explicitly'; end if;
    select id into app_id from public.applications where user_id = auth.uid() and lower(company) = lower(trim(company_name)) and lower(role) = lower(trim(role_name));
  end if;
  if app_id is null then
    insert into public.applications(user_id, company, role, status, source, applied_at, last_update_at)
    values(auth.uid(), trim(company_name), trim(role_name), new_status, 'Gmail', case when new_status = 'Applied' then item.received_at else null end, now()) returning id into app_id;
  else
    update public.applications set status = new_status, last_update_at = now() where id = app_id and user_id = auth.uid();
  end if;
  insert into public.application_events(user_id, application_id, event_type, description, source, occurred_at)
  values(auth.uid(), app_id, 'Email update', item.subject || E'\n' || item.excerpt, 'Gmail', item.received_at);
  update public.email_imports set review_status = 'applied', application_id = app_id where id = item.id and user_id = auth.uid();
  return app_id;
end;
$$;
revoke all on function public.accept_email_update(uuid,text,text,text,uuid) from public, anon;
grant execute on function public.accept_email_update(uuid,text,text,text,uuid) to authenticated;
commit;
