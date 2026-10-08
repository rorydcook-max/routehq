-- Money a customer pays towards a cost they were billed for (damage, a fine, fuel, cleaning).
-- It is income, kept apart from rent so a repair and what the customer paid towards it can be seen side by side.
alter type public.transaction_type add value if not exists 'charge_recovered';
