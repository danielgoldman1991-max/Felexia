-- Operational document flow: validate and issue the existing prepared version
-- atomically. This does not submit to DGI, sign, renumber or account a source.
begin;

create or replace function public.einvoice_issue_and_archive(p_document_id uuid,p_expected_version integer)
returns jsonb language plpgsql security definer set search_path=public,app_private as $$
declare doc public.einvoice_documents%rowtype; result jsonb;
begin
 select * into doc from public.einvoice_documents where id=p_document_id;
 if not found then raise exception 'EINVOICE_NOT_FOUND' using errcode='42501';end if;
 perform app_private.einvoice_assert_actor(auth.uid(),doc.organization_id,false,true);
 perform pg_advisory_xact_lock(hashtextextended('einvoice-source:'||doc.organization_id::text||':'||doc.source_kind||':'||doc.source_id::text,0));
 select * into doc from public.einvoice_documents where id=p_document_id and organization_id=doc.organization_id for update;
 if not found then raise exception 'EINVOICE_NOT_FOUND' using errcode='42501';end if;
 if p_expected_version is distinct from doc.current_version_number then raise exception 'EINVOICE_CONFLICT' using errcode='40001';end if;
 if not exists(select 1 from public.einvoice_settings where organization_id=doc.organization_id and enabled) then raise exception 'EINVOICE_MODULE_DISABLED' using errcode='42501';end if;
 if doc.status in('issued','ready_to_submit') and doc.issued_at is not null then
  return jsonb_build_object('document_id',doc.id,'version_id',doc.current_version_id,'version_number',doc.current_version_number,'status',doc.status,'reused',true);
 end if;
 if doc.status not in('draft','validated') then raise exception 'EINVOICE_INVALID_TRANSITION' using errcode='23514';end if;
 if doc.status='draft' then perform public.einvoice_transition(p_document_id,p_expected_version,'validated');end if;
 result:=public.einvoice_transition(p_document_id,p_expected_version,'issued');
 return result;
end $$;

-- Supabase can grant service_role EXECUTE explicitly through default privileges.
-- Revoking PUBLIC alone does not remove that inherited-at-creation grant.
revoke all on function public.einvoice_issue_and_archive(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.einvoice_issue_and_archive(uuid,integer) to authenticated;

-- Readiness metadata is tenant-authenticated and read-only, including for
-- subscribers with archive-only access. It grants no document mutation.
create or replace function public.einvoice_get_capabilities(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,app_private as $$
begin
 perform app_private.einvoice_assert_actor(auth.uid(),p_organization_id,false,false);
 return jsonb_build_object('workflow_version',2,'atomic_issuance',true);
end $$;

revoke all on function public.einvoice_get_capabilities(uuid) from public,anon,authenticated,service_role;
grant execute on function public.einvoice_get_capabilities(uuid) to authenticated;

select to_regprocedure('public.einvoice_issue_and_archive(uuid,integer)') is not null
 and to_regprocedure('public.einvoice_get_capabilities(uuid)') is not null as facturation_operations_103_active;
commit;
