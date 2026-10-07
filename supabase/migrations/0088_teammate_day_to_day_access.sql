-- RouteHQ has two roles in use: owner, and teammate (stored as "operator").
-- A teammate does the day-to-day work: bookings, vehicles, customers,
-- handovers and taking payments. The original rules were written for a
-- five-role plan and left "operator" out of most of that, so a teammate saw
-- empty money pages and some saves quietly did nothing.
--
-- This lets a teammate read and change day-to-day records. Business set-up
-- stays with owners (and the unused "manager" role): the business itself, the
-- team, branches, agreement and message templates, vehicle categories and
-- types, trackers and the set-up checklist are unchanged.

alter policy "Managers can manage rentals" on public.rentals
  using (has_org_role(organization_id, array['owner','manager','operator']::organization_role[]))
  with check (has_org_role(organization_id, array['owner','manager','operator']::organization_role[]));

alter policy "Managers can manage customers" on public.customers
  using (has_org_role(organization_id, array['owner','manager','operator']::organization_role[]))
  with check (has_org_role(organization_id, array['owner','manager','operator']::organization_role[]));

alter policy "Managers can manage vehicles" on public.vehicles
  using (has_org_role(organization_id, array['owner','manager','operator']::organization_role[]))
  with check (has_org_role(organization_id, array['owner','manager','operator']::organization_role[]));

alter policy "Managers can manage contracts" on public.contracts
  using (has_org_role(organization_id, array['owner','manager','operator']::organization_role[]))
  with check (has_org_role(organization_id, array['owner','manager','operator']::organization_role[]));

alter policy "Managers can create rental extensions" on public.rental_extensions
  with check (has_org_role(organization_id, array['owner','manager','operator']::organization_role[]));

alter policy "Managers can manage compliance events" on public.compliance_events
  using (has_org_role(organization_id, array['owner','manager','operator']::organization_role[]))
  with check (has_org_role(organization_id, array['owner','manager','operator']::organization_role[]));

alter policy "Managers can manage notifications" on public.notifications
  using (has_org_role(organization_id, array['owner','manager','operator']::organization_role[]))
  with check (has_org_role(organization_id, array['owner','manager','operator']::organization_role[]));

-- Money a teammate takes and needs to see: what is due, what has been paid.
alter policy "Finance roles can view rental payments" on public.rental_payments
  using ((deleted_at is null) and has_org_role(organization_id, array['owner','manager','accountant','operator']::organization_role[]));

alter policy "Finance roles can manage rental payments" on public.rental_payments
  using (has_org_role(organization_id, array['owner','manager','accountant','operator']::organization_role[]))
  with check (has_org_role(organization_id, array['owner','manager','accountant','operator']::organization_role[]));

alter policy "Finance roles can view transactions" on public.transactions
  using ((deleted_at is null) and has_org_role(organization_id, array['owner','manager','accountant','operator']::organization_role[]));

alter policy "Finance roles can manage transactions" on public.transactions
  using (has_org_role(organization_id, array['owner','manager','accountant','operator']::organization_role[]))
  with check (has_org_role(organization_id, array['owner','manager','accountant','operator']::organization_role[]));

alter policy "Finance roles can view invoices" on public.invoices
  using ((deleted_at is null) and has_org_role(organization_id, array['owner','manager','accountant','operator']::organization_role[]));

alter policy "Finance roles can manage invoices" on public.invoices
  using (has_org_role(organization_id, array['owner','manager','accountant','operator']::organization_role[]))
  with check (has_org_role(organization_id, array['owner','manager','accountant','operator']::organization_role[]));
