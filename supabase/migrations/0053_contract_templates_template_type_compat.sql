-- Phase 7 QA compatibility: rental-document preview expects contract_templates.template_type.
-- This is additive and keeps existing contract template rows as contract templates.

alter table public.contract_templates
  add column if not exists template_type public.template_type not null default 'contract';

create index if not exists contract_templates_type_lookup_idx
  on public.contract_templates(organization_id, template_type, template_key, locale, is_active);
