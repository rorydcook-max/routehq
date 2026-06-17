alter table public.users
  add column if not exists preferred_calendar text not null default 'gregory'
    check (preferred_calendar in ('gregory', 'buddhist'));

update public.users
set preferred_calendar = 'buddhist'
where preferred_locale = 'th'
  and preferred_calendar = 'gregory';
