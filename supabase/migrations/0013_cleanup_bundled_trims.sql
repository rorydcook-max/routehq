delete from public.vehicle_trims
where source = 'manual'
and name like '% / %';

delete from public.vehicle_trims
where source = 'manual'
and engine_cc is null
and transmission is null
and drivetrain is null;
