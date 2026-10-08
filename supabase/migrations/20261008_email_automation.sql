-- Run AFTER 20261008_email_reader.sql. All changes use the signed-in user's RLS.
begin;
alter table public.applications add column if not exists email_status_at timestamptz;
alter table public.email_imports add column if not exists gmail_thread_id text;
alter table public.email_imports add column if not exists automation_checked boolean not null default false;
alter table public.email_imports add column if not exists auto_applied boolean not null default false;
alter table public.email_imports add column if not exists undo_data jsonb;
alter table public.email_imports add column if not exists applied_version timestamptz;
alter table public.email_imports add column if not exists event_id uuid;
alter table public.email_imports add column if not exists action_id uuid;

create or replace function public.apply_email_automatically(import_id uuid, company_name text, role_name text, new_status text, target_application_id uuid default null, task_title text default null, automatic boolean default true)
returns uuid language plpgsql security invoker set search_path = public as $$
declare item public.email_imports%rowtype; app public.applications%rowtype; app_id uuid; matches integer; snapshot jsonb; version timestamptz := clock_timestamp(); ev uuid; task uuid; change_stage boolean; created boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  -- Serialize decisions and undo for one owner, including concurrent sync requests.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':email-automation', 0));
  select * into item from public.email_imports where id=import_id and user_id=auth.uid() for update;
  if not found then raise exception 'Email not found'; end if;
  if item.review_status='applied' then return item.application_id; end if;
  if item.review_status<>'pending' then raise exception 'Email is not pending'; end if;
  if length(trim(company_name)) not between 1 and 200 or length(trim(role_name)) not between 1 and 250 then raise exception 'Company and role required'; end if;
  if new_status is not null and new_status not in ('Saved','Applied','Screening','Interview','Final','Offer','Rejected','Withdrawn') then raise exception 'Invalid stage'; end if;
  if task_title is not null and task_title not in ('Send interview availability','Schedule interview') then raise exception 'Invalid action'; end if;
  if target_application_id is not null then
    select * into app from public.applications where id=target_application_id and user_id=auth.uid() for update;
    if not found then raise exception 'Application not found'; end if;
  else
    select count(*) into matches from public.applications where user_id=auth.uid() and lower(trim(company))=lower(trim(company_name)) and lower(trim(role))=lower(trim(role_name));
    if matches>1 then return null; end if;
    select * into app from public.applications where user_id=auth.uid() and lower(trim(company))=lower(trim(company_name)) and lower(trim(role))=lower(trim(role_name)) for update;
  end if;
  if app.id is null then
    if new_status is null then return null; end if;
    insert into public.applications(user_id,company,role,status,source,applied_at,last_update_at,email_status_at)
    values(auth.uid(),trim(company_name),trim(role_name),new_status,'Gmail',case when new_status='Applied' then item.received_at else null end,version,item.received_at) returning * into app;
    created := true;
  end if;
  app_id := app.id;
  -- Preserve manual edits newer than the last automatic change; ask for clarification instead.
  if automatic and not created and new_status is not null and (app.email_status_at is null or item.received_at >= app.email_status_at) and app.last_update_at > coalesce((select max(applied_version) from public.email_imports where user_id=auth.uid() and application_id=app.id and review_status='applied'), '-infinity'::timestamptz)
     and app.last_update_at > item.received_at and (app.email_status_at is not null or app.status <> 'Applied') then return null; end if;
  snapshot := jsonb_build_object('status',case when created then 'Saved' else app.status end,'last_update_at',app.last_update_at,'email_status_at',case when created then null else app.email_status_at end,'applied_at',case when created then null else app.applied_at end,'created',created);
  change_stage := new_status is not null and (app.email_status_at is null or item.received_at >= app.email_status_at);
  -- An old confirmation can fill the original applied date, but cannot rewind the stage.
  update public.applications set
    status=case when change_stage then new_status else status end,
    email_status_at=case when change_stage then item.received_at else email_status_at end,
    applied_at=case when new_status='Applied' and (applied_at is null or item.received_at<applied_at) then item.received_at else applied_at end,
    last_update_at=version where id=app_id and user_id=auth.uid();
  insert into public.application_events(user_id,application_id,event_type,description,source,occurred_at)
    values(auth.uid(),app_id,case when new_status in ('Interview','Final') then 'Interview' else 'Email update' end,item.subject || E'\n' || item.excerpt || E'\nSource: https://mail.google.com/mail/u/?authuser=' || item.mailbox_email || '#all/' || item.gmail_message_id,'Gmail',item.received_at) returning id into ev;
  -- Historical requests remain in the timeline; only recent actionable requests become tasks.
  if task_title is not null and item.received_at >= now()-interval '7 days' and change_stage and coalesce(new_status,app.status) not in ('Rejected','Withdrawn','Offer') and not exists(select 1 from public.actions where user_id=auth.uid() and application_id=app_id and title=task_title and completed=false) then
    insert into public.actions(user_id,application_id,title,action_type,completed) values(auth.uid(),app_id,task_title,'Interview',false) returning id into task;
  end if;
  update public.email_imports set review_status='applied',application_id=app_id,auto_applied=automatic,automation_checked=true,undo_data=snapshot,applied_version=version,event_id=ev,action_id=task where id=item.id and user_id=auth.uid();
  return app_id;
end; $$;

-- Manual clarification uses the same chronology and undo protections.
create or replace function public.accept_email_update(import_id uuid, company_name text, role_name text, new_status text, target_application_id uuid default null)
returns uuid language sql security invoker set search_path=public as $$
 select public.apply_email_automatically(import_id,company_name,role_name,new_status,target_application_id,null,false);
$$;

create or replace function public.undo_email_update(import_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
declare item public.email_imports%rowtype; app public.applications%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':email-automation',0));
 select * into item from public.email_imports where id=import_id and user_id=auth.uid() for update;
 if not found or item.review_status<>'applied' or item.undo_data is null then raise exception 'This update cannot be undone'; end if;
 select * into app from public.applications where id=item.application_id and user_id=auth.uid() for update;
 if not found or app.last_update_at is distinct from item.applied_version then raise exception 'The application changed afterwards. Undo its newer email updates first, or edit the application directly.'; end if;
 if item.action_id is not null and exists(select 1 from public.actions where id=item.action_id and user_id=auth.uid() and (completed=true or title not in ('Send interview availability','Schedule interview'))) then raise exception 'The generated task has changed. Edit the application directly.'; end if;
 update public.applications set status=item.undo_data->>'status',last_update_at=(item.undo_data->>'last_update_at')::timestamptz,email_status_at=(item.undo_data->>'email_status_at')::timestamptz,applied_at=(item.undo_data->>'applied_at')::timestamptz where id=app.id and user_id=auth.uid();
 delete from public.application_events where id=item.event_id and user_id=auth.uid();
 delete from public.actions where id=item.action_id and user_id=auth.uid();
 -- Keep newly created applications as Saved rather than deleting user records.
 update public.email_imports set review_status='ignored',undo_data=null,event_id=null,action_id=null where id=item.id and user_id=auth.uid();
end; $$;
revoke all on function public.apply_email_automatically(uuid,text,text,text,uuid,text,boolean) from public,anon;
grant execute on function public.apply_email_automatically(uuid,text,text,text,uuid,text,boolean) to authenticated;
revoke all on function public.undo_email_update(uuid) from public,anon;
grant execute on function public.undo_email_update(uuid) to authenticated;
commit;
