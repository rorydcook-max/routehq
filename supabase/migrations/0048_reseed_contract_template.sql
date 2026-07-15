-- Force reseed of contract template to pick up nested-if fix in default-en.html
update public.contract_templates
set content_html = '', body = ''
where template_key = 'standard_rental';
