-- Booking references start with the business's own short code instead of "FL-" (the old product name):
-- "Samui Car Rental" -> SCR-2026-0001, "Audit B Rentals" -> ABR-2026-0001, one word -> its first three letters.
-- The code is kept on the organization, filled the first time a reference is needed, so it stays the same if the
-- business is renamed later. Existing references stay as they are; numbering carries on per business and year.

alter table public.organizations add column if not exists booking_reference_prefix text;

-- 2-3 capital letters from a business name: the initials of its first words ("SamuiCar" reads as two words,
-- common accents are dropped), or the first letters of a one-word name. "BK" when nothing usable is left
-- (a name written only in a non-Latin script).
create or replace function public.booking_reference_prefix_for(org_name text)
returns text
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  spaced text;
  pair text;
  words text[];
  initials text := '';
  w text;
begin
  spaced := regexp_replace(coalesce(org_name, ''), '([a-z])([A-Z])', '\1 \2', 'g');
  foreach pair in array array[
    'A:ÀÁÂÃÄÅàáâãäåĄąĂăĀā', 'C:ÇçĆćČč', 'D:ĐđĎď', 'E:ÈÉÊËèéêëĘęĚěĒē', 'G:Ğğ', 'I:ÌÍÎÏìíîïİıĪī', 'L:Łł',
    'N:ÑñŃńŇň', 'O:ÒÓÔÕÖØòóôõöøŐőŌō', 'R:Řř', 'S:ŚśŠšŞşß', 'T:Ťť', 'U:ÙÚÛÜùúûüŰűŮůŪū', 'Y:Ýýÿ', 'Z:ŹźŻżŽž'
  ] loop
    spaced := translate(spaced, substr(pair, 3), repeat(left(pair, 1), char_length(substr(pair, 3))));
  end loop;
  -- "Bob's Bikes" is two words, not three.
  spaced := upper(regexp_replace(spaced, '[''’`]', '', 'g'));
  words := array_remove(regexp_split_to_array(btrim(regexp_replace(spaced, '[^A-Z0-9]+', ' ', 'g')), ' '), '');
  if coalesce(array_length(words, 1), 0) = 0 then
    return 'BK';
  end if;
  if array_length(words, 1) = 1 then
    initials := left(words[1], 3);
  else
    foreach w in array words[1:3] loop
      initials := initials || left(w, 1);
    end loop;
  end if;
  if char_length(initials) < 2 then
    return 'BK';
  end if;
  return initials;
end;
$$;

create or replace function public.generate_booking_reference(org_id uuid)
returns text
language plpgsql
set search_path = public, extensions
as $$
declare
  year_part text := to_char(now(), 'YYYY');
  seq_num integer;
  prefix text;
begin
  perform pg_advisory_xact_lock(hashtext(org_id::text), year_part::integer);

  select nullif(btrim(booking_reference_prefix), '') into prefix from public.organizations where id = org_id;
  if prefix is null then
    select public.booking_reference_prefix_for(name) into prefix from public.organizations where id = org_id;
    prefix := coalesce(prefix, 'BK');
    update public.organizations set booking_reference_prefix = prefix where id = org_id and booking_reference_prefix is null;
  end if;

  -- One number series per business and year, whatever prefix earlier references carry (FL-2026-0012 is followed
  -- by SCR-2026-0013), using MAX so deleted bookings never cause a repeat.
  select coalesce(max((regexp_match(reference, '^[A-Z0-9]+-' || year_part || '-(\d+)$'))[1]::integer), 0) + 1
  into seq_num
  from public.rentals
  where organization_id = org_id
    and reference ~ ('^[A-Z0-9]+-' || year_part || '-\d+$');

  return prefix || '-' || year_part || '-' || lpad(seq_num::text, 4, '0');
end;
$$;

-- The reference is made as the database owner: a teammate adding a booking can't update the organization (the
-- prefix is filled once), and the number must see every booking of the business, not only the rows they can read.
create or replace function public.set_rental_reference()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.reference is null or btrim(new.reference) = '' then
    new.reference := public.generate_booking_reference(new.organization_id);
  end if;

  if new.display_code is null or btrim(new.display_code) = '' then
    new.display_code := new.reference;
  end if;

  return new;
end;
$$;

-- Only the trigger makes references; nobody calls this through the API.
revoke execute on function public.generate_booking_reference(uuid) from public, anon, authenticated;
