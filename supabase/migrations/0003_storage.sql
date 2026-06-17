insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'video/mp4']
)
on conflict (id) do nothing;

create policy "Organization members can read scoped files" on storage.objects
  for select using (
    bucket_id = 'documents'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "Organization members can upload scoped files" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "Managers can update scoped files" on storage.objects
  for update using (
    bucket_id = 'documents'
    and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','manager']::public.organization_role[])
  )
  with check (
    bucket_id = 'documents'
    and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','manager']::public.organization_role[])
  );
