do $$
declare t text;
begin
  foreach t in array array['receipts','imported_bank_rows','reminder_rules','reminders','collection_cases'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

select public.create_policy_if_missing('receipts_org_all','receipts','create policy receipts_org_all on public.receipts for all to authenticated using (organization_id in (select private.current_user_organization_ids())) with check (organization_id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('imported_bank_rows_org_all','imported_bank_rows','create policy imported_bank_rows_org_all on public.imported_bank_rows for all to authenticated using (organization_id in (select private.current_user_organization_ids())) with check (organization_id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('reminder_rules_org_all','reminder_rules','create policy reminder_rules_org_all on public.reminder_rules for all to authenticated using (organization_id in (select private.current_user_organization_ids())) with check (organization_id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('reminders_org_all','reminders','create policy reminders_org_all on public.reminders for all to authenticated using (organization_id in (select private.current_user_organization_ids())) with check (organization_id in (select private.current_user_organization_ids()))');
select public.create_policy_if_missing('collection_cases_org_all','collection_cases','create policy collection_cases_org_all on public.collection_cases for all to authenticated using (organization_id in (select private.current_user_organization_ids())) with check (organization_id in (select private.current_user_organization_ids()))');
