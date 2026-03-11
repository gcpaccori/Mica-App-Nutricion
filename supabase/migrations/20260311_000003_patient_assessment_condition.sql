alter table public.patient_assessments
add column if not exists physiological_condition text;

alter table public.patient_assessments
drop constraint if exists patient_assessments_physiological_condition_check;

alter table public.patient_assessments
add constraint patient_assessments_physiological_condition_check
check (
  physiological_condition is null
  or physiological_condition in ('pregnancy', 'lactation')
);

create index if not exists patient_assessments_patient_condition_idx
on public.patient_assessments (patient_id, assessed_at desc, created_at desc);