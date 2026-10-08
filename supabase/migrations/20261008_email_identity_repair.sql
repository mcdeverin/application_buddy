-- Repair stored automatic imports without making any Gmail API calls.
begin;
alter table public.email_imports add column if not exists identity_revision integer not null default 0;
alter table public.email_imports add column if not exists repair_checked boolean not null default false;
alter table public.email_imports add column if not exists repair_data jsonb;
create or replace function public.repair_email_application(import_id uuid, company_name text default null, role_name text default null, corrected_status text default null)
returns boolean language plpgsql security invoker set search_path=public as $$
declare item public.email_imports%rowtype; app public.applications%rowtype; latest timestamptz; changed boolean := false;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if company_name is not null and length(trim(company_name)) not between 2 and 100 then raise exception 'Invalid company'; end if;
 if role_name is not null and length(trim(role_name)) not between 3 and 150 then raise exception 'Invalid role'; end if;
 if corrected_status is not null and corrected_status not in ('Applied','Screening','Interview','Final','Offer','Rejected') then raise exception 'Invalid status'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':email-automation',0));
 select * into item from public.email_imports where id=import_id and user_id=auth.uid() for update;
 if not found then raise exception 'Email not found'; end if;
 if item.repair_checked or not item.auto_applied or item.review_status<>'applied' then return false; end if;
 select * into app from public.applications where id=item.application_id and user_id=auth.uid() for update;
 select max(applied_version) into latest from public.email_imports where application_id=item.application_id and user_id=auth.uid() and review_status='applied';
 -- A newer email or manual edit owns the current application state.
 if app.id is not null and app.source='Gmail' and app.last_update_at=item.applied_version and item.applied_version=latest then
   changed := (company_name is not null and company_name<>app.company) or (role_name is not null and role_name<>app.role) or (corrected_status is not null and corrected_status<>app.status and (app.email_status_at is null or item.received_at>=app.email_status_at));
   if changed then
     update public.email_imports set repair_data=jsonb_build_object('company',app.company,'role',app.role,'status',app.status) where id=item.id and user_id=auth.uid();
     update public.applications set company=coalesce(company_name,company),role=coalesce(role_name,role),status=case when corrected_status is not null and (email_status_at is null or item.received_at>=email_status_at) then corrected_status else status end where id=app.id and user_id=auth.uid();
     if corrected_status is not null then
       update public.application_events set event_type=case when corrected_status in ('Interview','Final') then 'Interview' else 'Email update' end where id=item.event_id and user_id=auth.uid() and source='Gmail';
     end if;
     update public.email_imports set suggested_company=coalesce(company_name,suggested_company),suggested_role=coalesce(role_name,suggested_role),suggested_status=coalesce(corrected_status,suggested_status) where id=item.id and user_id=auth.uid();
   end if;
 end if;
 update public.email_imports set repair_checked=true where id=item.id and user_id=auth.uid();
 return changed;
end; $$;
revoke all on function public.repair_email_application(uuid,text,text,text) from public,anon;
grant execute on function public.repair_email_application(uuid,text,text,text) to authenticated;
commit;
