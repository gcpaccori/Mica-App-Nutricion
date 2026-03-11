create table if not exists public.nutrition_plan (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  nutritionist_id uuid not null references public.profiles(id) on delete restrict,
  source_goal_id uuid references public.patient_goals(id) on delete set null,
  source_diet_plan_id uuid references public.diet_plans(id) on delete set null,
  distribution_profile_id bigint references public.nutrition_meal_distribution_profile(id) on delete set null,
  code text,
  label text not null,
  objective_type text,
  sex sex_type not null,
  age_years integer,
  weight_reference_kg numeric(10,3),
  activity_label text,
  activity_factor_used numeric(8,4),
  estimated_bmr_kcal numeric(12,3),
  target_energy_kcal numeric(12,3),
  calculation_method text,
  status text not null default 'draft',
  starts_on date not null default current_date,
  ends_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists nutrition_plan_source_goal_uidx
on public.nutrition_plan (source_goal_id)
where source_goal_id is not null;

create unique index if not exists nutrition_plan_source_diet_plan_uidx
on public.nutrition_plan (source_diet_plan_id)
where source_diet_plan_id is not null;

create index if not exists nutrition_plan_patient_idx
on public.nutrition_plan (patient_id, created_at desc);

drop trigger if exists trg_nutrition_plan_updated_at on public.nutrition_plan;
create trigger trg_nutrition_plan_updated_at
before update on public.nutrition_plan
for each row execute function public.set_updated_at();

create table if not exists public.nutrition_plan_macro_target (
  nutrition_plan_id uuid primary key references public.nutrition_plan(id) on delete cascade,
  protein_pct numeric(8,4),
  carbs_pct numeric(8,4),
  fat_pct numeric(8,4),
  protein_target_g numeric(12,3),
  carbs_target_g numeric(12,3),
  fat_target_g numeric(12,3),
  protein_target_g_per_kg numeric(12,4),
  carbs_target_g_per_kg numeric(12,4),
  fat_target_g_per_kg numeric(12,4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_nutrition_plan_macro_target_updated_at on public.nutrition_plan_macro_target;
create trigger trg_nutrition_plan_macro_target_updated_at
before update on public.nutrition_plan_macro_target
for each row execute function public.set_updated_at();

create table if not exists public.nutrition_plan_micro_target (
  nutrition_plan_id uuid primary key references public.nutrition_plan(id) on delete cascade,
  fiber_target_g numeric(12,3),
  sodium_target_mg numeric(12,3),
  calcium_target_mg numeric(12,3),
  iron_target_mg numeric(12,3),
  vitamin_a_target_ug numeric(12,3),
  vitamin_c_target_mg numeric(12,3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_nutrition_plan_micro_target_updated_at on public.nutrition_plan_micro_target;
create trigger trg_nutrition_plan_micro_target_updated_at
before update on public.nutrition_plan_micro_target
for each row execute function public.set_updated_at();

create table if not exists public.nutrition_micronutrient_reference (
  id bigserial primary key,
  sex sex_type not null,
  condition text,
  age_min_months integer not null,
  age_max_months integer,
  fiber_g numeric(12,3),
  calcium_mg numeric(12,3),
  iron_mg numeric(12,3),
  vitamin_a_ug numeric(12,3),
  vitamin_c_mg numeric(12,3),
  source_note text
);

create unique index if not exists nutrition_micronutrient_reference_uidx
on public.nutrition_micronutrient_reference (
  sex,
  coalesce(condition, '__general__'),
  age_min_months,
  coalesce(age_max_months, -1)
);

alter table public.patient_goals
add column if not exists nutrition_plan_id uuid references public.nutrition_plan(id) on delete set null;

create index if not exists patient_goals_nutrition_plan_id_idx
on public.patient_goals (nutrition_plan_id);

alter table public.diet_plans
add column if not exists nutrition_plan_id uuid references public.nutrition_plan(id) on delete set null;

create index if not exists diet_plans_nutrition_plan_id_idx
on public.diet_plans (nutrition_plan_id);

alter table public.diet_meals
add column if not exists visible_name text;

alter table public.diet_meals
add column if not exists menu_text text;

alter table public.intake_meals
add column if not exists visible_name text;

alter table public.intake_meals
add column if not exists menu_text text;

with ranked_reference as (
  select
    dv.sex,
    dv.condition,
    dv.age_min_months,
    dv.age_max_months,
    dv.nutrient_key,
    dv.value,
    row_number() over (
      partition by dv.sex, dv.condition, dv.age_min_months, dv.age_max_months, dv.nutrient_key
      order by
        case dv.value_type
          when 'RDA_AI' then 1
          when 'EAR' then 2
          when 'UL' then 3
          else 99
        end,
        dv.source_table,
        dv.nutrient_key
    ) as row_num
  from public.dri_values dv
  where dv.sex in ('male', 'female')
    and dv.nutrient_key in ('total_fiber', 'fiber', 'calcium', 'iron', 'vitamin_a', 'vitamin_c')
), pivoted_reference as (
  select
    sex,
    condition,
    age_min_months,
    age_max_months,
    max(case when nutrient_key in ('total_fiber', 'fiber') then value end) as fiber_g,
    max(case when nutrient_key = 'calcium' then value end) as calcium_mg,
    max(case when nutrient_key = 'iron' then value end) as iron_mg,
    max(case when nutrient_key = 'vitamin_a' then value end) as vitamin_a_ug,
    max(case when nutrient_key = 'vitamin_c' then value end) as vitamin_c_mg
  from ranked_reference
  where row_num = 1
  group by sex, condition, age_min_months, age_max_months
)
insert into public.nutrition_micronutrient_reference (
  sex,
  condition,
  age_min_months,
  age_max_months,
  fiber_g,
  calcium_mg,
  iron_mg,
  vitamin_a_ug,
  vitamin_c_mg,
  source_note
)
select
  sex,
  condition,
  age_min_months,
  age_max_months,
  fiber_g,
  calcium_mg,
  iron_mg,
  vitamin_a_ug,
  vitamin_c_mg,
  'Derived from dri_values for workbook-compatible micronutrient targets'
from pivoted_reference
where not exists (
  select 1
  from public.nutrition_micronutrient_reference existing
  where existing.sex = pivoted_reference.sex
    and coalesce(existing.condition, '__general__') = coalesce(pivoted_reference.condition, '__general__')
    and existing.age_min_months = pivoted_reference.age_min_months
    and coalesce(existing.age_max_months, -1) = coalesce(pivoted_reference.age_max_months, -1)
);

with default_distribution as (
  select id
  from public.nutrition_meal_distribution_profile
  where code = 'standard_5_meals_20_10_30_10_30'
  limit 1
), goal_seed as (
  select
    g.id as goal_id,
    g.patient_id,
    p.nutritionist_id,
    p.sex,
    greatest(0, extract(year from age(coalesce(g.start_date, current_date), p.birth_date))::int) as age_years,
    g.goal_type,
    g.weight_reference_kg,
    g.activity_factor_used,
    g.estimated_bmr_kcal,
    g.target_energy_kcal,
    g.calculation_method,
    g.start_date,
    g.end_date,
    g.notes,
    g.target_protein_pct,
    g.target_carbs_pct,
    g.target_fat_pct,
    g.target_protein_g,
    g.target_carbs_g,
    g.target_fat_g,
    g.target_protein_g_per_kg,
    g.target_carbs_g_per_kg,
    g.target_fat_g_per_kg,
    g.target_fiber_g,
    g.target_sodium_mg,
    g.target_calcium_mg,
    g.target_iron_mg,
    g.target_vitamin_a_ug,
    g.target_vitamin_c_mg
  from public.patient_goals g
  join public.patients p on p.id = g.patient_id
)
insert into public.nutrition_plan (
    patient_id,
    nutritionist_id,
    source_goal_id,
    distribution_profile_id,
    code,
    label,
    objective_type,
    sex,
    age_years,
    weight_reference_kg,
    activity_label,
    activity_factor_used,
    estimated_bmr_kcal,
    target_energy_kcal,
    calculation_method,
    status,
    starts_on,
    ends_on,
    notes
  )
  select
    seed.patient_id,
    seed.nutritionist_id,
    seed.goal_id,
    (select id from default_distribution),
    concat('goal-', left(seed.goal_id::text, 8)),
    concat('Caso nutricional ', seed.goal_type, ' ', to_char(seed.start_date, 'YYYY-MM-DD')),
    seed.goal_type,
    seed.sex,
    seed.age_years,
    seed.weight_reference_kg,
    null,
    seed.activity_factor_used,
    seed.estimated_bmr_kcal,
    seed.target_energy_kcal,
    seed.calculation_method,
    case when seed.end_date is null or seed.end_date >= current_date then 'active' else 'archived' end,
    seed.start_date,
    seed.end_date,
    seed.notes
  from goal_seed seed
  where not exists (
    select 1
    from public.nutrition_plan existing
    where existing.source_goal_id = seed.goal_id
  );

update public.patient_goals g
set nutrition_plan_id = np.id
from public.nutrition_plan np
where np.source_goal_id = g.id
  and g.nutrition_plan_id is null;

insert into public.nutrition_plan_macro_target (
  nutrition_plan_id,
  protein_pct,
  carbs_pct,
  fat_pct,
  protein_target_g,
  carbs_target_g,
  fat_target_g,
  protein_target_g_per_kg,
  carbs_target_g_per_kg,
  fat_target_g_per_kg
)
select
  np.id,
  g.target_protein_pct,
  g.target_carbs_pct,
  g.target_fat_pct,
  g.target_protein_g,
  g.target_carbs_g,
  g.target_fat_g,
  g.target_protein_g_per_kg,
  g.target_carbs_g_per_kg,
  g.target_fat_g_per_kg
from public.patient_goals g
join public.nutrition_plan np on np.source_goal_id = g.id
on conflict (nutrition_plan_id) do nothing;

insert into public.nutrition_plan_micro_target (
  nutrition_plan_id,
  fiber_target_g,
  sodium_target_mg,
  calcium_target_mg,
  iron_target_mg,
  vitamin_a_target_ug,
  vitamin_c_target_mg
)
select
  np.id,
  g.target_fiber_g,
  g.target_sodium_mg,
  g.target_calcium_mg,
  g.target_iron_mg,
  g.target_vitamin_a_ug,
  g.target_vitamin_c_mg
from public.patient_goals g
join public.nutrition_plan np on np.source_goal_id = g.id
on conflict (nutrition_plan_id) do nothing;

with default_distribution as (
  select id
  from public.nutrition_meal_distribution_profile
  where code = 'standard_5_meals_20_10_30_10_30'
  limit 1
)
update public.nutrition_plan np
set
  source_diet_plan_id = dp.id,
  nutritionist_id = dp.nutritionist_id,
  distribution_profile_id = coalesce(np.distribution_profile_id, (select id from default_distribution)),
  label = coalesce(nullif(dp.name, ''), np.label),
  objective_type = coalesce(dp.objective_type, np.objective_type),
  activity_label = coalesce(np.activity_label, p.activity_level::text),
  weight_reference_kg = coalesce(np.weight_reference_kg, pm.weight_kg),
  target_energy_kcal = coalesce(dp.daily_energy_target_kcal, np.target_energy_kcal),
  calculation_method = coalesce(np.calculation_method, 'manual_plan'),
  status = dp.status::text,
  ends_on = coalesce(dp.end_date, np.ends_on),
  notes = coalesce(dp.notes, np.notes),
  updated_at = now()
from public.diet_plans dp
join public.patients p on p.id = dp.patient_id
left join lateral (
  select weight_kg
  from public.patient_measurements pm
  where pm.patient_id = dp.patient_id
    and pm.weight_kg is not null
  order by pm.measured_at desc, pm.created_at desc
  limit 1
) pm on true
where np.source_goal_id = dp.goal_id
  and dp.goal_id is not null
  and np.source_diet_plan_id is null
  and not exists (
    select 1
    from public.nutrition_plan taken
    where taken.source_diet_plan_id = dp.id
  );

update public.diet_plans dp
set nutrition_plan_id = np.id
from public.nutrition_plan np
where np.source_goal_id = dp.goal_id
  and dp.goal_id is not null
  and dp.nutrition_plan_id is null;

with default_distribution as (
  select id
  from public.nutrition_meal_distribution_profile
  where code = 'standard_5_meals_20_10_30_10_30'
  limit 1
)
insert into public.nutrition_plan (
  patient_id,
  nutritionist_id,
  source_diet_plan_id,
  distribution_profile_id,
  code,
  label,
  objective_type,
  sex,
  age_years,
  weight_reference_kg,
  activity_label,
  activity_factor_used,
  estimated_bmr_kcal,
  target_energy_kcal,
  calculation_method,
  status,
  starts_on,
  ends_on,
  notes
)
select
  dp.patient_id,
  dp.nutritionist_id,
  dp.id,
  (select id from default_distribution),
  concat('plan-', left(dp.id::text, 8)),
  dp.name,
  dp.objective_type,
  p.sex,
  greatest(0, extract(year from age(coalesce(dp.start_date, current_date), p.birth_date))::int),
  pm.weight_kg,
  p.activity_level::text,
  g.activity_factor_used,
  g.estimated_bmr_kcal,
  coalesce(dp.daily_energy_target_kcal, g.target_energy_kcal),
  coalesce(g.calculation_method, 'manual_plan'),
  dp.status::text,
  dp.start_date,
  dp.end_date,
  coalesce(dp.notes, g.notes)
from public.diet_plans dp
join public.patients p on p.id = dp.patient_id
left join public.patient_goals g on g.id = dp.goal_id
left join lateral (
  select weight_kg
  from public.patient_measurements pm
  where pm.patient_id = dp.patient_id
    and pm.weight_kg is not null
  order by pm.measured_at desc, pm.created_at desc
  limit 1
) pm on true
where dp.nutrition_plan_id is null
  and not exists (
  select 1
  from public.nutrition_plan np
  where np.source_diet_plan_id = dp.id
)
;

update public.diet_plans dp
set nutrition_plan_id = np.id
from public.nutrition_plan np
where np.source_diet_plan_id = dp.id
  and dp.nutrition_plan_id is null;

insert into public.nutrition_plan_macro_target (
  nutrition_plan_id,
  protein_pct,
  carbs_pct,
  fat_pct,
  protein_target_g,
  carbs_target_g,
  fat_target_g,
  protein_target_g_per_kg,
  carbs_target_g_per_kg,
  fat_target_g_per_kg
)
select
  dp.nutrition_plan_id,
  coalesce(g.target_protein_pct, case when dp.daily_protein_target_g is not null and coalesce(dp.daily_energy_target_kcal, 0) > 0 then (dp.daily_protein_target_g * 4) / dp.daily_energy_target_kcal end),
  coalesce(g.target_carbs_pct, case when dp.daily_carbs_target_g is not null and coalesce(dp.daily_energy_target_kcal, 0) > 0 then (dp.daily_carbs_target_g * 4) / dp.daily_energy_target_kcal end),
  coalesce(g.target_fat_pct, case when dp.daily_fat_target_g is not null and coalesce(dp.daily_energy_target_kcal, 0) > 0 then (dp.daily_fat_target_g * 9) / dp.daily_energy_target_kcal end),
  coalesce(dp.daily_protein_target_g, g.target_protein_g),
  coalesce(dp.daily_carbs_target_g, g.target_carbs_g),
  coalesce(dp.daily_fat_target_g, g.target_fat_g),
  coalesce(g.target_protein_g_per_kg, case when pm.weight_kg is not null and pm.weight_kg > 0 and dp.daily_protein_target_g is not null then dp.daily_protein_target_g / pm.weight_kg end),
  coalesce(g.target_carbs_g_per_kg, case when pm.weight_kg is not null and pm.weight_kg > 0 and dp.daily_carbs_target_g is not null then dp.daily_carbs_target_g / pm.weight_kg end),
  coalesce(g.target_fat_g_per_kg, case when pm.weight_kg is not null and pm.weight_kg > 0 and dp.daily_fat_target_g is not null then dp.daily_fat_target_g / pm.weight_kg end)
from public.diet_plans dp
left join public.patient_goals g on g.id = dp.goal_id
left join lateral (
  select weight_kg
  from public.patient_measurements pm
  where pm.patient_id = dp.patient_id
    and pm.weight_kg is not null
  order by pm.measured_at desc, pm.created_at desc
  limit 1
) pm on true
where dp.nutrition_plan_id is not null
on conflict (nutrition_plan_id) do update
set
  protein_pct = coalesce(excluded.protein_pct, public.nutrition_plan_macro_target.protein_pct),
  carbs_pct = coalesce(excluded.carbs_pct, public.nutrition_plan_macro_target.carbs_pct),
  fat_pct = coalesce(excluded.fat_pct, public.nutrition_plan_macro_target.fat_pct),
  protein_target_g = coalesce(excluded.protein_target_g, public.nutrition_plan_macro_target.protein_target_g),
  carbs_target_g = coalesce(excluded.carbs_target_g, public.nutrition_plan_macro_target.carbs_target_g),
  fat_target_g = coalesce(excluded.fat_target_g, public.nutrition_plan_macro_target.fat_target_g),
  protein_target_g_per_kg = coalesce(excluded.protein_target_g_per_kg, public.nutrition_plan_macro_target.protein_target_g_per_kg),
  carbs_target_g_per_kg = coalesce(excluded.carbs_target_g_per_kg, public.nutrition_plan_macro_target.carbs_target_g_per_kg),
  fat_target_g_per_kg = coalesce(excluded.fat_target_g_per_kg, public.nutrition_plan_macro_target.fat_target_g_per_kg),
  updated_at = now();

insert into public.nutrition_plan_micro_target (
  nutrition_plan_id,
  fiber_target_g,
  sodium_target_mg,
  calcium_target_mg,
  iron_target_mg,
  vitamin_a_target_ug,
  vitamin_c_target_mg
)
select
  dp.nutrition_plan_id,
  coalesce(dp.daily_fiber_target_g, g.target_fiber_g),
  coalesce(dp.daily_sodium_target_mg, g.target_sodium_mg),
  g.target_calcium_mg,
  g.target_iron_mg,
  g.target_vitamin_a_ug,
  g.target_vitamin_c_mg
from public.diet_plans dp
left join public.patient_goals g on g.id = dp.goal_id
where dp.nutrition_plan_id is not null
on conflict (nutrition_plan_id) do update
set
  fiber_target_g = coalesce(excluded.fiber_target_g, public.nutrition_plan_micro_target.fiber_target_g),
  sodium_target_mg = coalesce(excluded.sodium_target_mg, public.nutrition_plan_micro_target.sodium_target_mg),
  calcium_target_mg = coalesce(excluded.calcium_target_mg, public.nutrition_plan_micro_target.calcium_target_mg),
  iron_target_mg = coalesce(excluded.iron_target_mg, public.nutrition_plan_micro_target.iron_target_mg),
  vitamin_a_target_ug = coalesce(excluded.vitamin_a_target_ug, public.nutrition_plan_micro_target.vitamin_a_target_ug),
  vitamin_c_target_mg = coalesce(excluded.vitamin_c_target_mg, public.nutrition_plan_micro_target.vitamin_c_target_mg),
  updated_at = now();

create or replace view public.nutrition_plan_case_v as
select
  np.id as nutrition_plan_id,
  np.patient_id,
  np.nutritionist_id,
  np.source_goal_id,
  np.source_diet_plan_id,
  np.code,
  np.label,
  np.objective_type,
  np.sex,
  np.age_years,
  np.weight_reference_kg,
  np.activity_label,
  np.activity_factor_used,
  np.estimated_bmr_kcal,
  np.target_energy_kcal,
  np.calculation_method,
  np.status,
  np.starts_on,
  np.ends_on,
  nmt.protein_pct,
  nmt.carbs_pct,
  nmt.fat_pct,
  nmt.protein_target_g,
  nmt.carbs_target_g,
  nmt.fat_target_g,
  nmt.protein_target_g_per_kg,
  nmt.carbs_target_g_per_kg,
  nmt.fat_target_g_per_kg,
  nmic.fiber_target_g,
  nmic.sodium_target_mg,
  nmic.calcium_target_mg,
  nmic.iron_target_mg,
  nmic.vitamin_a_target_ug,
  nmic.vitamin_c_target_mg,
  np.notes,
  np.created_at,
  np.updated_at
from public.nutrition_plan np
left join public.nutrition_plan_macro_target nmt on nmt.nutrition_plan_id = np.id
left join public.nutrition_plan_micro_target nmic on nmic.nutrition_plan_id = np.id;

create or replace view public.nutrition_plan_meal_target_v as
select
  np.id as nutrition_plan_id,
  mdi.sequence_no,
  mdi.meal_code,
  mdi.meal_label,
  mdi.energy_pct,
  np.target_energy_kcal * mdi.energy_pct as target_energy_kcal,
  nmt.protein_target_g * mdi.energy_pct as target_protein_g,
  nmt.fat_target_g * mdi.energy_pct as target_fat_g,
  nmt.carbs_target_g * mdi.energy_pct as target_carbs_g,
  nmic.fiber_target_g * mdi.energy_pct as target_fiber_g,
  nmic.sodium_target_mg * mdi.energy_pct as target_sodium_mg,
  nmic.calcium_target_mg * mdi.energy_pct as target_calcium_mg,
  nmic.iron_target_mg * mdi.energy_pct as target_iron_mg,
  nmic.vitamin_a_target_ug * mdi.energy_pct as target_vitamin_a_ug,
  nmic.vitamin_c_target_mg * mdi.energy_pct as target_vitamin_c_mg
from public.nutrition_plan np
join public.nutrition_meal_distribution_item mdi on mdi.profile_id = np.distribution_profile_id
left join public.nutrition_plan_macro_target nmt on nmt.nutrition_plan_id = np.id
left join public.nutrition_plan_micro_target nmic on nmic.nutrition_plan_id = np.id;

create or replace view public.diet_meal_nutrients_extended_v as
select
  dm.id as meal_id,
  dmd.id as plan_day_id,
  dmd.plan_id,
  dmd.day_number,
  mt.code as meal_type_code,
  mt.name as meal_type_name,
  dm.visible_name,
  dm.menu_text,
  dm.target_distribution_pct,
  dm.target_energy_kcal,
  coalesce(sum(dmin.energy_kcal), 0) as actual_energy_kcal,
  coalesce(sum(dmin.protein_g), 0) as actual_protein_g,
  coalesce(sum(dmin.fat_g), 0) as actual_fat_g,
  coalesce(sum(dmin.carbs_g), 0) as actual_carbs_g,
  coalesce(sum(dmin.fiber_g), 0) as actual_fiber_g,
  coalesce(sum(dmin.sodium_mg), 0) as actual_sodium_mg,
  coalesce(sum(dmin.calcium_mg), 0) as actual_calcium_mg,
  coalesce(sum(dmin.iron_mg), 0) as actual_iron_mg,
  coalesce(sum(dmin.vitamin_a_rae_ug), 0) as actual_vitamin_a_ug,
  coalesce(sum(dmin.vitamin_c_mg), 0) as actual_vitamin_c_mg
from public.diet_meals dm
join public.diet_plan_days dmd on dmd.id = dm.plan_day_id
join public.meal_types mt on mt.id = dm.meal_type_id
left join public.diet_meal_item_nutrients_v dmin on dmin.meal_id = dm.id
group by dm.id, dmd.id, dmd.plan_id, dmd.day_number, mt.code, mt.name, dm.visible_name, dm.menu_text, dm.target_distribution_pct, dm.target_energy_kcal;

create or replace view public.diet_plan_day_nutrients_extended_v as
select
  dmd.id as plan_day_id,
  dmd.plan_id,
  dmd.day_number,
  coalesce(sum(dmin.energy_kcal), 0) as actual_energy_kcal,
  coalesce(sum(dmin.protein_g), 0) as actual_protein_g,
  coalesce(sum(dmin.fat_g), 0) as actual_fat_g,
  coalesce(sum(dmin.carbs_g), 0) as actual_carbs_g,
  coalesce(sum(dmin.fiber_g), 0) as actual_fiber_g,
  coalesce(sum(dmin.sodium_mg), 0) as actual_sodium_mg,
  coalesce(sum(dmin.calcium_mg), 0) as actual_calcium_mg,
  coalesce(sum(dmin.iron_mg), 0) as actual_iron_mg,
  coalesce(sum(dmin.vitamin_a_rae_ug), 0) as actual_vitamin_a_ug,
  coalesce(sum(dmin.vitamin_c_mg), 0) as actual_vitamin_c_mg
from public.diet_plan_days dmd
left join public.diet_meals dm on dm.plan_day_id = dmd.id
left join public.diet_meal_item_nutrients_v dmin on dmin.meal_id = dm.id
group by dmd.id, dmd.plan_id, dmd.day_number;

create or replace view public.intake_day_nutrients_extended_v as
select
  iday.id as intake_day_id,
  iday.patient_id,
  iday.plan_id,
  iday.intake_date,
  coalesce(sum(imin.energy_kcal), 0) as actual_energy_kcal,
  coalesce(sum(imin.protein_g), 0) as actual_protein_g,
  coalesce(sum(imin.fat_g), 0) as actual_fat_g,
  coalesce(sum(imin.carbs_g), 0) as actual_carbs_g,
  coalesce(sum(imin.fiber_g), 0) as actual_fiber_g,
  coalesce(sum(imin.sodium_mg), 0) as actual_sodium_mg,
  coalesce(sum(imin.calcium_mg), 0) as actual_calcium_mg,
  coalesce(sum(imin.iron_mg), 0) as actual_iron_mg,
  coalesce(sum(imin.vitamin_a_rae_ug), 0) as actual_vitamin_a_ug,
  coalesce(sum(imin.vitamin_c_mg), 0) as actual_vitamin_c_mg
from public.intake_days iday
left join public.intake_meals imeal on imeal.intake_day_id = iday.id
left join public.intake_meal_item_nutrients_v imin on imin.intake_meal_id = imeal.id
group by iday.id, iday.patient_id, iday.plan_id, iday.intake_date;

create or replace view public.diet_meal_adequacy_v as
select
  meal.meal_id,
  meal.plan_day_id,
  meal.plan_id,
  meal.day_number,
  meal.meal_type_code,
  meal.meal_type_name,
  meal.visible_name,
  meal.menu_text,
  coalesce(meal.target_distribution_pct, target.energy_pct) as meal_target_pct,
  coalesce(meal.target_energy_kcal, target.target_energy_kcal) as meal_target_kcal,
  meal.actual_energy_kcal as meal_actual_kcal,
  meal.actual_energy_kcal - coalesce(meal.target_energy_kcal, target.target_energy_kcal) as meal_deviation_kcal,
  case
    when coalesce(meal.target_energy_kcal, target.target_energy_kcal) is null or coalesce(meal.target_energy_kcal, target.target_energy_kcal) = 0 then null
    else ((meal.actual_energy_kcal - coalesce(meal.target_energy_kcal, target.target_energy_kcal)) / coalesce(meal.target_energy_kcal, target.target_energy_kcal)) * 100
  end as meal_deviation_pct,
  public.calculate_percentage(meal.actual_energy_kcal, coalesce(meal.target_energy_kcal, target.target_energy_kcal)) as energy_adequacy_pct,
  public.calculate_percentage(meal.actual_protein_g, target.target_protein_g) as protein_adequacy_pct,
  public.calculate_percentage(meal.actual_fat_g, target.target_fat_g) as fat_adequacy_pct,
  public.calculate_percentage(meal.actual_carbs_g, target.target_carbs_g) as carbs_adequacy_pct,
  public.calculate_percentage(meal.actual_fiber_g, target.target_fiber_g) as fiber_adequacy_pct,
  public.calculate_percentage(meal.actual_calcium_mg, target.target_calcium_mg) as calcium_adequacy_pct,
  public.calculate_percentage(meal.actual_iron_mg, target.target_iron_mg) as iron_adequacy_pct,
  public.calculate_percentage(meal.actual_vitamin_a_ug, target.target_vitamin_a_ug) as vitamin_a_adequacy_pct,
  public.calculate_percentage(meal.actual_vitamin_c_mg, target.target_vitamin_c_mg) as vitamin_c_adequacy_pct,
  meal.actual_protein_g,
  meal.actual_fat_g,
  meal.actual_carbs_g,
  meal.actual_fiber_g,
  meal.actual_sodium_mg,
  meal.actual_calcium_mg,
  meal.actual_iron_mg,
  meal.actual_vitamin_a_ug,
  meal.actual_vitamin_c_mg,
  target.target_protein_g,
  target.target_fat_g,
  target.target_carbs_g,
  target.target_fiber_g,
  target.target_sodium_mg,
  target.target_calcium_mg,
  target.target_iron_mg,
  target.target_vitamin_a_ug,
  target.target_vitamin_c_mg
from public.diet_meal_nutrients_extended_v meal
join public.diet_plans dp on dp.id = meal.plan_id
left join public.nutrition_plan_meal_target_v target
  on target.nutrition_plan_id = dp.nutrition_plan_id
 and target.meal_code = meal.meal_type_code;

create or replace view public.diet_plan_day_adequacy_v as
select
  day_totals.plan_day_id,
  day_totals.plan_id,
  day_totals.day_number,
  day_totals.actual_energy_kcal,
  day_totals.actual_protein_g,
  day_totals.actual_fat_g,
  day_totals.actual_carbs_g,
  day_totals.actual_fiber_g,
  day_totals.actual_sodium_mg,
  day_totals.actual_calcium_mg,
  day_totals.actual_iron_mg,
  day_totals.actual_vitamin_a_ug,
  day_totals.actual_vitamin_c_mg,
  npc.target_energy_kcal,
  npc.protein_target_g,
  npc.fat_target_g,
  npc.carbs_target_g,
  npc.fiber_target_g,
  npc.sodium_target_mg,
  npc.calcium_target_mg,
  npc.iron_target_mg,
  npc.vitamin_a_target_ug,
  npc.vitamin_c_target_mg,
  public.calculate_percentage(day_totals.actual_energy_kcal, npc.target_energy_kcal) as energy_adequacy_pct,
  public.calculate_percentage(day_totals.actual_protein_g, npc.protein_target_g) as protein_adequacy_pct,
  public.calculate_percentage(day_totals.actual_fat_g, npc.fat_target_g) as fat_adequacy_pct,
  public.calculate_percentage(day_totals.actual_carbs_g, npc.carbs_target_g) as carbs_adequacy_pct,
  public.calculate_percentage(day_totals.actual_fiber_g, npc.fiber_target_g) as fiber_adequacy_pct,
  public.calculate_percentage(day_totals.actual_calcium_mg, npc.calcium_target_mg) as calcium_adequacy_pct,
  public.calculate_percentage(day_totals.actual_iron_mg, npc.iron_target_mg) as iron_adequacy_pct,
  public.calculate_percentage(day_totals.actual_vitamin_a_ug, npc.vitamin_a_target_ug) as vitamin_a_adequacy_pct,
  public.calculate_percentage(day_totals.actual_vitamin_c_mg, npc.vitamin_c_target_mg) as vitamin_c_adequacy_pct
from public.diet_plan_day_nutrients_extended_v day_totals
join public.diet_plans dp on dp.id = day_totals.plan_id
left join public.nutrition_plan_case_v npc on npc.nutrition_plan_id = dp.nutrition_plan_id;

create or replace view public.intake_day_adequacy_v as
select
  intake.intake_day_id,
  intake.patient_id,
  intake.plan_id,
  intake.intake_date,
  intake.actual_energy_kcal,
  intake.actual_protein_g,
  intake.actual_fat_g,
  intake.actual_carbs_g,
  intake.actual_fiber_g,
  intake.actual_sodium_mg,
  intake.actual_calcium_mg,
  intake.actual_iron_mg,
  intake.actual_vitamin_a_ug,
  intake.actual_vitamin_c_mg,
  npc.target_energy_kcal,
  npc.protein_target_g,
  npc.fat_target_g,
  npc.carbs_target_g,
  npc.fiber_target_g,
  npc.sodium_target_mg,
  npc.calcium_target_mg,
  npc.iron_target_mg,
  npc.vitamin_a_target_ug,
  npc.vitamin_c_target_mg,
  public.calculate_percentage(intake.actual_energy_kcal, npc.target_energy_kcal) as energy_adequacy_pct,
  public.calculate_percentage(intake.actual_protein_g, npc.protein_target_g) as protein_adequacy_pct,
  public.calculate_percentage(intake.actual_fat_g, npc.fat_target_g) as fat_adequacy_pct,
  public.calculate_percentage(intake.actual_carbs_g, npc.carbs_target_g) as carbs_adequacy_pct,
  public.calculate_percentage(intake.actual_fiber_g, npc.fiber_target_g) as fiber_adequacy_pct,
  public.calculate_percentage(intake.actual_calcium_mg, npc.calcium_target_mg) as calcium_adequacy_pct,
  public.calculate_percentage(intake.actual_iron_mg, npc.iron_target_mg) as iron_adequacy_pct,
  public.calculate_percentage(intake.actual_vitamin_a_ug, npc.vitamin_a_target_ug) as vitamin_a_adequacy_pct,
  public.calculate_percentage(intake.actual_vitamin_c_mg, npc.vitamin_c_target_mg) as vitamin_c_adequacy_pct
from public.intake_day_nutrients_extended_v intake
left join public.diet_plans dp on dp.id = intake.plan_id
left join public.nutrition_plan_case_v npc on npc.nutrition_plan_id = dp.nutrition_plan_id;

alter table public.nutrition_plan enable row level security;
alter table public.nutrition_plan_macro_target enable row level security;
alter table public.nutrition_plan_micro_target enable row level security;
alter table public.nutrition_micronutrient_reference enable row level security;

drop policy if exists nutrition_plan_policy on public.nutrition_plan;
create policy nutrition_plan_policy on public.nutrition_plan
for all using (
  exists (
    select 1
    from public.patients p
    where p.id = nutrition_plan.patient_id
      and (p.nutritionist_id = auth.uid() or public.is_admin() or p.profile_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.patients p
    where p.id = nutrition_plan.patient_id
      and (p.nutritionist_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists nutrition_plan_macro_target_policy on public.nutrition_plan_macro_target;
create policy nutrition_plan_macro_target_policy on public.nutrition_plan_macro_target
for all using (
  exists (
    select 1
    from public.nutrition_plan np
    join public.patients p on p.id = np.patient_id
    where np.id = nutrition_plan_macro_target.nutrition_plan_id
      and (p.nutritionist_id = auth.uid() or public.is_admin() or p.profile_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.nutrition_plan np
    join public.patients p on p.id = np.patient_id
    where np.id = nutrition_plan_macro_target.nutrition_plan_id
      and (p.nutritionist_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists nutrition_plan_micro_target_policy on public.nutrition_plan_micro_target;
create policy nutrition_plan_micro_target_policy on public.nutrition_plan_micro_target
for all using (
  exists (
    select 1
    from public.nutrition_plan np
    join public.patients p on p.id = np.patient_id
    where np.id = nutrition_plan_micro_target.nutrition_plan_id
      and (p.nutritionist_id = auth.uid() or public.is_admin() or p.profile_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.nutrition_plan np
    join public.patients p on p.id = np.patient_id
    where np.id = nutrition_plan_micro_target.nutrition_plan_id
      and (p.nutritionist_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists nutrition_micronutrient_reference_select on public.nutrition_micronutrient_reference;
create policy nutrition_micronutrient_reference_select on public.nutrition_micronutrient_reference
for select using (auth.uid() is not null);