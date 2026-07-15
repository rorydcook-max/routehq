-- Force contract template refresh: blank content so isStaleDefaultTemplate
-- triggers a rebuild from default-en.html on next request.
-- Safe to run multiple times (idempotent via the length check).
update public.contract_templates
set content_html = '', body = ''
where template_key = 'standard_rental'
  and length(coalesce(content_html, '')) < 40000;
-- Only blanks templates shorter than 40000 chars (the stale ones).
-- The current correct template is ~45000 chars and will not be touched.
