-- Migration: Add DRI reference tables and helper functions
-- Purpose: store Dietary Reference Intakes (DRIs) extracted from user-provided JSON

create table if not exists public.dri_values (
  id bigserial primary key,
  source_table text,
  nutrient_key text not null,
  nutrient_label text,
  unit text,
  value_type text not null, -- e.g., RDA, AI, EAR, UL
  value numeric, -- numeric value for the given life stage
  life_stage_label text, -- human label like '19-30 y' or '0-6 mo'
  age_min_months integer, -- inclusive
  age_max_months integer, -- inclusive
  sex sex_type default 'other', -- 'male','female','other'
  condition text,
  group_name text,
  basis text,
  special text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dri_values add column if not exists source_table text;
alter table public.dri_values add column if not exists condition text;
alter table public.dri_values add column if not exists group_name text;
alter table public.dri_values add column if not exists basis text;
alter table public.dri_values add column if not exists special text;

create index if not exists idx_dri_nutrient on public.dri_values (nutrient_key);
create index if not exists idx_dri_lifestage on public.dri_values (age_min_months, age_max_months, sex);

drop trigger if exists trg_dri_values_updated_at on public.dri_values;
create trigger trg_dri_values_updated_at
before update on public.dri_values
for each row execute function public.set_updated_at();

-- Helper: compute age in months between two dates
create or replace function public.age_in_months(birth date, ref_date date)
returns integer
language sql
immutable
as $$
  select date_part('year', age(ref_date, birth)) * 12 + date_part('month', age(ref_date, birth));
$$;

-- Return applicable DRI targets for a patient given birth date and sex.
-- This function selects the set of dri_values matching the age-in-months and sex (or sex='other' as fallback).
create or replace function public.get_dri_targets_for_patient(
  p_birth_date date,
  p_sex sex_type,
  p_ref_date date default current_date,
  p_condition text default null
)
returns table(source_table text, nutrient_key text, nutrient_label text, unit text, value_type text, value numeric, life_stage_label text, condition text, group_name text, basis text, special text)
language plpgsql
stable
as $$
declare
  age_months integer := public.age_in_months(p_birth_date, p_ref_date);
begin
  return query
    select dv.source_table, dv.nutrient_key, dv.nutrient_label, dv.unit, dv.value_type, dv.value, dv.life_stage_label, dv.condition, dv.group_name, dv.basis, dv.special
    from public.dri_values dv
    where dv.age_min_months <= age_months
      and dv.age_max_months >= age_months
      and (dv.sex = p_sex or dv.sex = 'other')
      and (
        (p_condition is null and dv.condition is null)
        or dv.condition = p_condition
      )
    order by dv.nutrient_key, dv.value_type desc;
end;
$$;

-- Convenience RPC: call with a patient id to get their DRIs (reads patients.birth_date and sex)
create or replace function public.get_patient_dri_targets(p_patient_id uuid, p_condition text default null)
returns table(source_table text, nutrient_key text, nutrient_label text, unit text, value_type text, value numeric, life_stage_label text, condition text, group_name text, basis text, special text)
language sql
stable
as $$
  select t.* from public.patients p
  join lateral public.get_dri_targets_for_patient(p.birth_date, p.sex, current_date, p_condition) t on true
  where p.id = p_patient_id;
$$;

-- NOTE: This migration creates the storage and helper functions only. To populate the table
-- with the provided DRI JSON you exported (the repository includes a parsed JSON), use the
-- Supabase SQL editor or psql to bulk insert rows into public.dri_values. A simple approach is:

-- COPY (nutrient_key, nutrient_label, unit, value_type, value, life_stage_label, age_min_months, age_max_months, sex) FROM '/path/to/dri_dump.csv' WITH (FORMAT csv, HEADER true);

-- The JSON file attached to the conversation can be transformed into CSV or SQL INSERTs using a small script.
