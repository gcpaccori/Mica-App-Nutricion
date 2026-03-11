create table if not exists public.nutrition_bmr_rule (
  id bigserial primary key,
  sex text not null check (sex in ('male', 'female')),
  age_min_years int not null,
  age_max_years int,
  weight_multiplier numeric(10,4) not null,
  kcal_constant numeric(10,4) not null,
  source_note text
);

create table if not exists public.nutrition_activity_level (
  id bigserial primary key,
  code text not null unique,
  label text not null,
  naf_reference numeric(10,4) not null,
  source_note text
);

create table if not exists public.nutrition_meal_distribution_profile (
  id bigserial primary key,
  code text not null unique,
  label text not null
);

create table if not exists public.nutrition_meal_distribution_item (
  id bigserial primary key,
  profile_id bigint not null references public.nutrition_meal_distribution_profile(id) on delete cascade,
  sequence_no int not null,
  meal_code text not null,
  meal_label text not null,
  energy_pct numeric(10,4) not null,
  unique(profile_id, meal_code)
);

insert into public.nutrition_bmr_rule (sex, age_min_years, age_max_years, weight_multiplier, kcal_constant, source_note) values
('male',0,2,60.9,-54,'FAO/OMS/UNU workbook'),
('female',0,2,61.0,-51,'FAO/OMS/UNU workbook'),
('male',3,9,22.7,495,'FAO/OMS/UNU workbook'),
('female',3,9,22.5,499,'FAO/OMS/UNU workbook'),
('male',10,17,17.5,651,'FAO/OMS/UNU workbook'),
('female',10,17,12.2,746,'FAO/OMS/UNU workbook'),
('male',18,30,15.06,692.2,'FAO/OMS/UNU workbook'),
('female',18,30,14.8,486.6,'FAO/OMS/UNU workbook'),
('male',30,60,11.4,873.1,'FAO/OMS/UNU workbook'),
('female',30,60,8.13,845.6,'FAO/OMS/UNU workbook'),
('male',61,null,11.7,587.7,'FAO/OMS/UNU workbook'),
('female',61,null,9.08,658.5,'FAO/OMS/UNU workbook')
on conflict do nothing;

insert into public.nutrition_activity_level (code, label, naf_reference, source_note) values
('sedentary','Sedentaria',1.40,'Workbook mapping'),
('light','Ligera',1.55,'Workbook mapping'),
('moderate','Moderada',1.85,'Workbook mapping'),
('high','Alta',2.20,'Workbook mapping'),
('very_high','Muy alta',2.40,'Workbook mapping')
on conflict (code) do nothing;

insert into public.nutrition_meal_distribution_profile (code, label) values
('standard_5_meals_20_10_30_10_30','5 tiempos 20/10/30/10/30')
on conflict (code) do nothing;

insert into public.nutrition_meal_distribution_item (profile_id, sequence_no, meal_code, meal_label, energy_pct)
select p.id, v.sequence_no, v.meal_code, v.meal_label, v.energy_pct
from public.nutrition_meal_distribution_profile p
join (values
  (1,'breakfast','Desayuno',0.2),
  (2,'mid_morning','Merienda 1',0.1),
  (3,'lunch','Almuerzo',0.3),
  (4,'mid_afternoon','Merienda 2',0.1),
  (5,'dinner','Cena',0.3)
) as v(sequence_no, meal_code, meal_label, energy_pct) on true
where p.code = 'standard_5_meals_20_10_30_10_30'
on conflict (profile_id, meal_code) do nothing;

alter table public.patient_goals
add column if not exists calculation_method text;

alter table public.patient_goals
add column if not exists weight_reference_kg numeric(10,3);

alter table public.patient_goals
add column if not exists estimated_bmr_kcal numeric(12,3);

alter table public.patient_goals
add column if not exists activity_factor_used numeric(8,4);

alter table public.patient_goals
add column if not exists target_protein_pct numeric(8,4);

alter table public.patient_goals
add column if not exists target_carbs_pct numeric(8,4);

alter table public.patient_goals
add column if not exists target_fat_pct numeric(8,4);

alter table public.patient_goals
add column if not exists target_protein_g_per_kg numeric(12,4);

alter table public.patient_goals
add column if not exists target_carbs_g_per_kg numeric(12,4);

alter table public.patient_goals
add column if not exists target_fat_g_per_kg numeric(12,4);

alter table public.patient_goals
add column if not exists target_calcium_mg numeric(12,3);

alter table public.patient_goals
add column if not exists target_iron_mg numeric(12,3);

alter table public.patient_goals
add column if not exists target_vitamin_a_ug numeric(12,3);

alter table public.patient_goals
add column if not exists target_vitamin_c_mg numeric(12,3);