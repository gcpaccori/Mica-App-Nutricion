create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'sex_type') then
    create type sex_type as enum ('male', 'female', 'other');
  end if;

  if not exists (select 1 from pg_type where typname = 'activity_level_type') then
    create type activity_level_type as enum ('sedentary', 'light', 'moderate', 'high', 'very_high');
  end if;

  if not exists (select 1 from pg_type where typname = 'plan_status_type') then
    create type plan_status_type as enum ('draft', 'active', 'completed', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'meal_status_type') then
    create type meal_status_type as enum ('planned', 'completed', 'partial', 'omitted', 'replaced');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.scale_nutrient(value_per_100g numeric, grams numeric)
returns numeric
language sql
immutable
as $$
  select (coalesce(value_per_100g, 0) * coalesce(grams, 0)) / 100;
$$;

create or replace function public.calculate_bmi(weight_kg numeric, height_m numeric)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(weight_kg, 0) > 0 and coalesce(height_m, 0) > 0
      then weight_kg / power(height_m, 2)
    else null
  end;
$$;

create or replace function public.calculate_percentage(actual_value numeric, target_value numeric)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(target_value, 0) = 0 then null
    else (coalesce(actual_value, 0) / target_value) * 100
  end;
$$;

create or replace function public.calculate_weight_change_pct(current_weight numeric, reference_weight numeric)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(reference_weight, 0) = 0 then null
    else ((coalesce(current_weight, 0) - reference_weight) / reference_weight) * 100
  end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_name text;
begin
  generated_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    split_part(coalesce(new.email, ''), '@', 1),
    'Usuario'
  );

  insert into public.profiles (id, full_name, email)
  values (new.id, generated_name, new.email)
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.roles (
  id bigint generated always as identity primary key,
  code text not null unique,
  name text not null
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id bigint not null references public.roles(id) on delete restrict,
  primary key (user_id, role_id)
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.has_role(role_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code = role_code
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('admin');
$$;

create or replace function public.is_nutritionist()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('nutritionist');
$$;

create or replace function public.is_patient()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('patient');
$$;

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  nutritionist_id uuid not null references public.profiles(id) on delete restrict,
  profile_id uuid unique references public.profiles(id) on delete set null,
  first_name text not null,
  last_name text not null,
  birth_date date not null,
  sex sex_type not null,
  document_number text,
  phone text,
  email text,
  occupation text,
  activity_level activity_level_type default 'sedentary',
  allergies text,
  intolerances text,
  medical_notes text,
  lifestyle_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists patients_nutritionist_id_idx on public.patients (nutritionist_id);
create index if not exists patients_profile_id_idx on public.patients (profile_id);

drop trigger if exists trg_patients_updated_at on public.patients;
create trigger trg_patients_updated_at
before update on public.patients
for each row execute function public.set_updated_at();

create table if not exists public.patient_measurements (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  measured_at date not null,
  weight_kg numeric(10,3),
  height_m numeric(10,3),
  bmi numeric(10,3),
  waist_cm numeric(10,3),
  hip_cm numeric(10,3),
  usual_weight_kg numeric(10,3),
  weight_change_pct numeric(10,3),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists patient_measurements_patient_id_idx on public.patient_measurements (patient_id, measured_at desc);

create or replace function public.set_measurement_derived_fields()
returns trigger
language plpgsql
as $$
begin
  new.bmi := public.calculate_bmi(new.weight_kg, new.height_m);
  new.weight_change_pct := public.calculate_weight_change_pct(new.weight_kg, new.usual_weight_kg);
  return new;
end;
$$;

drop trigger if exists trg_patient_measurements_derived on public.patient_measurements;
create trigger trg_patient_measurements_derived
before insert or update on public.patient_measurements
for each row execute function public.set_measurement_derived_fields();

create table if not exists public.patient_assessments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  assessed_at date not null,
  appetite_level text,
  hydration_ml numeric(12,3),
  recall_24h text,
  food_frequency_notes text,
  eating_out_notes text,
  adherence_barriers text,
  clinical_notes text,
  created_at timestamptz not null default now()
);

create index if not exists patient_assessments_patient_id_idx on public.patient_assessments (patient_id, assessed_at desc);

create table if not exists public.patient_goals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  goal_type text not null,
  target_weight_kg numeric(10,3),
  target_energy_kcal numeric(12,3),
  target_protein_g numeric(12,3),
  target_fat_g numeric(12,3),
  target_carbs_g numeric(12,3),
  target_fiber_g numeric(12,3),
  target_sodium_mg numeric(12,3),
  start_date date not null,
  end_date date,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists patient_goals_patient_id_idx on public.patient_goals (patient_id, is_active);

create table if not exists public.meal_types (
  id smallint generated always as identity primary key,
  code text not null unique,
  name text not null,
  sort_order smallint not null
);

create table if not exists public.diet_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  nutritionist_id uuid not null references public.profiles(id) on delete restrict,
  goal_id uuid references public.patient_goals(id) on delete set null,
  name text not null,
  objective_type text not null,
  diet_type text,
  start_date date not null,
  end_date date,
  status plan_status_type not null default 'draft',
  daily_energy_target_kcal numeric(12,3),
  daily_protein_target_g numeric(12,3),
  daily_fat_target_g numeric(12,3),
  daily_carbs_target_g numeric(12,3),
  daily_fiber_target_g numeric(12,3),
  daily_sodium_target_mg numeric(12,3),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists diet_plans_patient_id_idx on public.diet_plans (patient_id, status);

drop trigger if exists trg_diet_plans_updated_at on public.diet_plans;
create trigger trg_diet_plans_updated_at
before update on public.diet_plans
for each row execute function public.set_updated_at();

create table if not exists public.diet_plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.diet_plans(id) on delete cascade,
  day_number smallint not null,
  label text,
  unique (plan_id, day_number)
);

create table if not exists public.diet_meals (
  id uuid primary key default gen_random_uuid(),
  plan_day_id uuid not null references public.diet_plan_days(id) on delete cascade,
  meal_type_id smallint not null references public.meal_types(id) on delete restrict,
  target_distribution_pct numeric(8,3),
  target_energy_kcal numeric(12,3),
  notes text
);

create table if not exists public.diet_meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.diet_meals(id) on delete cascade,
  alimento_id bigint not null references public.alimentos_26_grupos(id) on delete restrict,
  quantity_grams numeric(12,3) not null check (quantity_grams > 0),
  household_measure text,
  household_quantity numeric(12,3),
  instructions text,
  item_order smallint not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists diet_meal_items_meal_id_idx on public.diet_meal_items (meal_id, item_order);
create index if not exists diet_meal_items_alimento_id_idx on public.diet_meal_items (alimento_id);

create table if not exists public.intake_days (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  plan_id uuid references public.diet_plans(id) on delete set null,
  intake_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (patient_id, intake_date)
);

create table if not exists public.intake_meals (
  id uuid primary key default gen_random_uuid(),
  intake_day_id uuid not null references public.intake_days(id) on delete cascade,
  meal_type_id smallint not null references public.meal_types(id) on delete restrict,
  status meal_status_type not null default 'planned',
  notes text
);

create table if not exists public.intake_meal_items (
  id uuid primary key default gen_random_uuid(),
  intake_meal_id uuid not null references public.intake_meals(id) on delete cascade,
  planned_meal_item_id uuid references public.diet_meal_items(id) on delete set null,
  alimento_id bigint not null references public.alimentos_26_grupos(id) on delete restrict,
  quantity_grams numeric(12,3) not null check (quantity_grams > 0),
  household_measure text,
  household_quantity numeric(12,3),
  consumed boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists intake_meal_items_intake_meal_id_idx on public.intake_meal_items (intake_meal_id);
create index if not exists intake_meal_items_alimento_id_idx on public.intake_meal_items (alimento_id);

create table if not exists public.patient_progress_snapshots (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  plan_id uuid references public.diet_plans(id) on delete set null,
  period_type text not null,
  period_start date not null,
  period_end date not null,
  planned_energy_kcal numeric(12,3),
  actual_energy_kcal numeric(12,3),
  planned_protein_g numeric(12,3),
  actual_protein_g numeric(12,3),
  planned_fiber_g numeric(12,3),
  actual_fiber_g numeric(12,3),
  planned_sodium_mg numeric(12,3),
  actual_sodium_mg numeric(12,3),
  adherence_pct numeric(12,3),
  avg_weight_kg numeric(12,3),
  weight_change_pct numeric(12,3),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.nutrient_reference_sets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  source_name text not null,
  sex sex_type,
  min_age_months integer,
  max_age_months integer,
  pregnancy boolean,
  lactation boolean,
  notes text
);

create table if not exists public.nutrient_reference_values (
  id uuid primary key default gen_random_uuid(),
  reference_set_id uuid not null references public.nutrient_reference_sets(id) on delete cascade,
  nutrient_code text not null,
  nutrient_name text not null,
  unit text not null,
  reference_type text not null,
  value numeric(14,6) not null,
  unique (reference_set_id, nutrient_code, reference_type)
);

insert into public.roles (code, name)
values
  ('admin', 'Administrador'),
  ('nutritionist', 'Nutricionista'),
  ('patient', 'Paciente')
on conflict (code) do nothing;

insert into public.meal_types (code, name, sort_order)
values
  ('breakfast', 'Desayuno', 1),
  ('mid_morning', 'Media manana', 2),
  ('lunch', 'Almuerzo', 3),
  ('mid_afternoon', 'Media tarde', 4),
  ('dinner', 'Cena', 5),
  ('night_snack', 'Colacion nocturna', 6),
  ('extra', 'Extra', 7)
on conflict (code) do nothing;

create or replace view public.diet_meal_item_nutrients_v as
select
  dmi.id,
  dmi.meal_id,
  dmi.alimento_id,
  dmi.quantity_grams,
  food.grupo_numero,
  food.grupo_nombre,
  food.grupo_slug,
  food.alimento,
  public.scale_nutrient(food.valor_energetico_kcal, dmi.quantity_grams) as energy_kcal,
  public.scale_nutrient(food.proteinas_g, dmi.quantity_grams) as protein_g,
  public.scale_nutrient(food.lipidos_totales_g, dmi.quantity_grams) as fat_g,
  public.scale_nutrient(food.carbohidratos_disponibles_g, dmi.quantity_grams) as carbs_g,
  public.scale_nutrient(food.fibra_alimentaria_g, dmi.quantity_grams) as fiber_g,
  public.scale_nutrient(food.azucar_total_g, dmi.quantity_grams) as sugar_g,
  public.scale_nutrient(food.azucar_agregado_g, dmi.quantity_grams) as added_sugar_g,
  public.scale_nutrient(food.sodio_mg, dmi.quantity_grams) as sodium_mg,
  public.scale_nutrient(food.potasio_mg, dmi.quantity_grams) as potassium_mg,
  public.scale_nutrient(food.calcio_mg, dmi.quantity_grams) as calcium_mg,
  public.scale_nutrient(food.hierro_mg, dmi.quantity_grams) as iron_mg,
  public.scale_nutrient(food.magnesio_mg, dmi.quantity_grams) as magnesium_mg,
  public.scale_nutrient(food.zinc_mg, dmi.quantity_grams) as zinc_mg,
  public.scale_nutrient(food.niacina_mg, dmi.quantity_grams) as niacin_mg,
  public.scale_nutrient(food.folato_efd_ug, dmi.quantity_grams) as folate_efd_ug,
  public.scale_nutrient(food.vitamina_a_rae_ug, dmi.quantity_grams) as vitamin_a_rae_ug,
  public.scale_nutrient(food.vitamina_b_12_ug, dmi.quantity_grams) as vitamin_b12_ug,
  public.scale_nutrient(food.vitamina_c_mg, dmi.quantity_grams) as vitamin_c_mg,
  public.scale_nutrient(food.vitamina_d_ug, dmi.quantity_grams) as vitamin_d_ug
from public.diet_meal_items dmi
join public.alimentos_26_grupos food on food.id = dmi.alimento_id;

create or replace view public.intake_meal_item_nutrients_v as
select
  imi.id,
  imi.intake_meal_id,
  imi.planned_meal_item_id,
  imi.alimento_id,
  imi.quantity_grams,
  imi.consumed,
  food.grupo_numero,
  food.grupo_nombre,
  food.grupo_slug,
  food.alimento,
  public.scale_nutrient(food.valor_energetico_kcal, imi.quantity_grams) as energy_kcal,
  public.scale_nutrient(food.proteinas_g, imi.quantity_grams) as protein_g,
  public.scale_nutrient(food.lipidos_totales_g, imi.quantity_grams) as fat_g,
  public.scale_nutrient(food.carbohidratos_disponibles_g, imi.quantity_grams) as carbs_g,
  public.scale_nutrient(food.fibra_alimentaria_g, imi.quantity_grams) as fiber_g,
  public.scale_nutrient(food.azucar_total_g, imi.quantity_grams) as sugar_g,
  public.scale_nutrient(food.azucar_agregado_g, imi.quantity_grams) as added_sugar_g,
  public.scale_nutrient(food.sodio_mg, imi.quantity_grams) as sodium_mg,
  public.scale_nutrient(food.potasio_mg, imi.quantity_grams) as potassium_mg,
  public.scale_nutrient(food.calcio_mg, imi.quantity_grams) as calcium_mg,
  public.scale_nutrient(food.hierro_mg, imi.quantity_grams) as iron_mg,
  public.scale_nutrient(food.magnesio_mg, imi.quantity_grams) as magnesium_mg,
  public.scale_nutrient(food.zinc_mg, imi.quantity_grams) as zinc_mg,
  public.scale_nutrient(food.niacina_mg, imi.quantity_grams) as niacin_mg,
  public.scale_nutrient(food.folato_efd_ug, imi.quantity_grams) as folate_efd_ug,
  public.scale_nutrient(food.vitamina_a_rae_ug, imi.quantity_grams) as vitamin_a_rae_ug,
  public.scale_nutrient(food.vitamina_b_12_ug, imi.quantity_grams) as vitamin_b12_ug,
  public.scale_nutrient(food.vitamina_c_mg, imi.quantity_grams) as vitamin_c_mg,
  public.scale_nutrient(food.vitamina_d_ug, imi.quantity_grams) as vitamin_d_ug
from public.intake_meal_items imi
join public.alimentos_26_grupos food on food.id = imi.alimento_id;

create or replace view public.diet_meal_totals_v as
select
  dm.id as meal_id,
  dmd.plan_id,
  dmd.day_number,
  mt.code as meal_type_code,
  mt.name as meal_type_name,
  coalesce(sum(dmin.energy_kcal), 0) as energy_kcal,
  coalesce(sum(dmin.protein_g), 0) as protein_g,
  coalesce(sum(dmin.fat_g), 0) as fat_g,
  coalesce(sum(dmin.carbs_g), 0) as carbs_g,
  coalesce(sum(dmin.fiber_g), 0) as fiber_g,
  coalesce(sum(dmin.sodium_mg), 0) as sodium_mg
from public.diet_meals dm
join public.diet_plan_days dmd on dmd.id = dm.plan_day_id
join public.meal_types mt on mt.id = dm.meal_type_id
left join public.diet_meal_item_nutrients_v dmin on dmin.meal_id = dm.id
group by dm.id, dmd.plan_id, dmd.day_number, mt.code, mt.name;

create or replace view public.diet_plan_day_totals_v as
select
  plan_id,
  day_number,
  coalesce(sum(energy_kcal), 0) as energy_kcal,
  coalesce(sum(protein_g), 0) as protein_g,
  coalesce(sum(fat_g), 0) as fat_g,
  coalesce(sum(carbs_g), 0) as carbs_g,
  coalesce(sum(fiber_g), 0) as fiber_g,
  coalesce(sum(sodium_mg), 0) as sodium_mg
from public.diet_meal_totals_v
group by plan_id, day_number;

create or replace view public.intake_day_totals_v as
select
  iday.id as intake_day_id,
  iday.patient_id,
  iday.plan_id,
  iday.intake_date,
  coalesce(sum(imin.energy_kcal), 0) as energy_kcal,
  coalesce(sum(imin.protein_g), 0) as protein_g,
  coalesce(sum(imin.fat_g), 0) as fat_g,
  coalesce(sum(imin.carbs_g), 0) as carbs_g,
  coalesce(sum(imin.fiber_g), 0) as fiber_g,
  coalesce(sum(imin.sodium_mg), 0) as sodium_mg
from public.intake_days iday
left join public.intake_meals imeal on imeal.intake_day_id = iday.id
left join public.intake_meal_item_nutrients_v imin on imin.intake_meal_id = imeal.id
group by iday.id, iday.patient_id, iday.plan_id, iday.intake_date;

create or replace view public.daily_plan_vs_intake_v as
select
  intake.patient_id,
  intake.plan_id,
  intake.intake_date,
  plan.energy_kcal as planned_energy_kcal,
  intake.energy_kcal as actual_energy_kcal,
  plan.protein_g as planned_protein_g,
  intake.protein_g as actual_protein_g,
  plan.fiber_g as planned_fiber_g,
  intake.fiber_g as actual_fiber_g,
  plan.sodium_mg as planned_sodium_mg,
  intake.sodium_mg as actual_sodium_mg,
  public.calculate_percentage(intake.energy_kcal, plan.energy_kcal) as energy_adequacy_pct,
  public.calculate_percentage(intake.protein_g, plan.protein_g) as protein_adequacy_pct,
  public.calculate_percentage(intake.fiber_g, plan.fiber_g) as fiber_adequacy_pct,
  public.calculate_percentage(plan.energy_kcal - abs(plan.energy_kcal - intake.energy_kcal), plan.energy_kcal) as adherence_pct
from public.intake_day_totals_v intake
left join public.diet_plan_day_totals_v plan
  on plan.plan_id = intake.plan_id
 and plan.day_number = greatest(1, extract(isodow from intake.intake_date)::int);

create or replace view public.intake_group_summary_v as
select
  iday.patient_id,
  iday.intake_date,
  imin.grupo_numero,
  imin.grupo_nombre,
  count(*) as item_count,
  coalesce(sum(imin.quantity_grams), 0) as grams_total,
  coalesce(sum(imin.energy_kcal), 0) as energy_kcal,
  coalesce(sum(imin.protein_g), 0) as protein_g,
  coalesce(sum(imin.fiber_g), 0) as fiber_g,
  coalesce(sum(imin.sodium_mg), 0) as sodium_mg
from public.intake_days iday
join public.intake_meals imeal on imeal.intake_day_id = iday.id
join public.intake_meal_item_nutrients_v imin on imin.intake_meal_id = imeal.id
group by iday.patient_id, iday.intake_date, imin.grupo_numero, imin.grupo_nombre;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.patients enable row level security;
alter table public.patient_measurements enable row level security;
alter table public.patient_assessments enable row level security;
alter table public.patient_goals enable row level security;
alter table public.diet_plans enable row level security;
alter table public.diet_plan_days enable row level security;
alter table public.diet_meals enable row level security;
alter table public.diet_meal_items enable row level security;
alter table public.intake_days enable row level security;
alter table public.intake_meals enable row level security;
alter table public.intake_meal_items enable row level security;
alter table public.patient_progress_snapshots enable row level security;
alter table public.nutrient_reference_sets enable row level security;
alter table public.nutrient_reference_values enable row level security;
alter table public.roles enable row level security;
alter table public.meal_types enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
for update using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

drop policy if exists roles_read on public.roles;
create policy roles_read on public.roles
for select using (auth.role() = 'authenticated');

drop policy if exists meal_types_read on public.meal_types;
create policy meal_types_read on public.meal_types
for select using (auth.role() = 'authenticated');

drop policy if exists user_roles_read on public.user_roles;
create policy user_roles_read on public.user_roles
for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists user_roles_manage on public.user_roles;
create policy user_roles_manage on public.user_roles
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists patients_select on public.patients;
create policy patients_select on public.patients
for select using (
  public.is_admin()
  or nutritionist_id = auth.uid()
  or profile_id = auth.uid()
);

drop policy if exists patients_insert on public.patients;
create policy patients_insert on public.patients
for insert with check (
  public.is_admin() or (public.is_nutritionist() and nutritionist_id = auth.uid())
);

drop policy if exists patients_update on public.patients;
create policy patients_update on public.patients
for update using (
  public.is_admin() or nutritionist_id = auth.uid()
)
with check (
  public.is_admin() or nutritionist_id = auth.uid()
);

drop policy if exists patients_delete on public.patients;
create policy patients_delete on public.patients
for delete using (
  public.is_admin() or nutritionist_id = auth.uid()
);

drop policy if exists patient_measurements_policy on public.patient_measurements;
create policy patient_measurements_policy on public.patient_measurements
for all using (
  public.is_admin() or exists (
    select 1 from public.patients p
    where p.id = patient_measurements.patient_id
      and (p.nutritionist_id = auth.uid() or p.profile_id = auth.uid())
  )
)
with check (
  public.is_admin() or exists (
    select 1 from public.patients p
    where p.id = patient_measurements.patient_id
      and p.nutritionist_id = auth.uid()
  )
);

drop policy if exists patient_assessments_policy on public.patient_assessments;
create policy patient_assessments_policy on public.patient_assessments
for all using (
  public.is_admin() or exists (
    select 1 from public.patients p
    where p.id = patient_assessments.patient_id
      and (p.nutritionist_id = auth.uid() or p.profile_id = auth.uid())
  )
)
with check (
  public.is_admin() or exists (
    select 1 from public.patients p
    where p.id = patient_assessments.patient_id
      and p.nutritionist_id = auth.uid()
  )
);

drop policy if exists patient_goals_policy on public.patient_goals;
create policy patient_goals_policy on public.patient_goals
for all using (
  public.is_admin() or exists (
    select 1 from public.patients p
    where p.id = patient_goals.patient_id
      and (p.nutritionist_id = auth.uid() or p.profile_id = auth.uid())
  )
)
with check (
  public.is_admin() or exists (
    select 1 from public.patients p
    where p.id = patient_goals.patient_id
      and p.nutritionist_id = auth.uid()
  )
);

drop policy if exists diet_plans_policy on public.diet_plans;
create policy diet_plans_policy on public.diet_plans
for all using (
  public.is_admin() or nutritionist_id = auth.uid() or exists (
    select 1 from public.patients p
    where p.id = diet_plans.patient_id
      and p.profile_id = auth.uid()
  )
)
with check (
  public.is_admin() or nutritionist_id = auth.uid()
);

drop policy if exists diet_plan_days_policy on public.diet_plan_days;
create policy diet_plan_days_policy on public.diet_plan_days
for all using (
  public.is_admin() or exists (
    select 1 from public.diet_plans dp
    where dp.id = diet_plan_days.plan_id
      and (dp.nutritionist_id = auth.uid() or exists (
        select 1 from public.patients p
        where p.id = dp.patient_id
          and p.profile_id = auth.uid()
      ))
  )
)
with check (
  public.is_admin() or exists (
    select 1 from public.diet_plans dp
    where dp.id = diet_plan_days.plan_id
      and dp.nutritionist_id = auth.uid()
  )
);

drop policy if exists diet_meals_policy on public.diet_meals;
create policy diet_meals_policy on public.diet_meals
for all using (
  public.is_admin() or exists (
    select 1
    from public.diet_plan_days dpd
    join public.diet_plans dp on dp.id = dpd.plan_id
    where dpd.id = diet_meals.plan_day_id
      and (dp.nutritionist_id = auth.uid() or exists (
        select 1 from public.patients p
        where p.id = dp.patient_id
          and p.profile_id = auth.uid()
      ))
  )
)
with check (
  public.is_admin() or exists (
    select 1
    from public.diet_plan_days dpd
    join public.diet_plans dp on dp.id = dpd.plan_id
    where dpd.id = diet_meals.plan_day_id
      and dp.nutritionist_id = auth.uid()
  )
);

drop policy if exists diet_meal_items_policy on public.diet_meal_items;
create policy diet_meal_items_policy on public.diet_meal_items
for all using (
  public.is_admin() or exists (
    select 1
    from public.diet_meals dm
    join public.diet_plan_days dpd on dpd.id = dm.plan_day_id
    join public.diet_plans dp on dp.id = dpd.plan_id
    where dm.id = diet_meal_items.meal_id
      and (dp.nutritionist_id = auth.uid() or exists (
        select 1 from public.patients p
        where p.id = dp.patient_id
          and p.profile_id = auth.uid()
      ))
  )
)
with check (
  public.is_admin() or exists (
    select 1
    from public.diet_meals dm
    join public.diet_plan_days dpd on dpd.id = dm.plan_day_id
    join public.diet_plans dp on dp.id = dpd.plan_id
    where dm.id = diet_meal_items.meal_id
      and dp.nutritionist_id = auth.uid()
  )
);

drop policy if exists intake_days_policy on public.intake_days;
create policy intake_days_policy on public.intake_days
for all using (
  public.is_admin() or exists (
    select 1 from public.patients p
    where p.id = intake_days.patient_id
      and (p.nutritionist_id = auth.uid() or p.profile_id = auth.uid())
  )
)
with check (
  public.is_admin() or exists (
    select 1 from public.patients p
    where p.id = intake_days.patient_id
      and (p.nutritionist_id = auth.uid() or p.profile_id = auth.uid())
  )
);

drop policy if exists intake_meals_policy on public.intake_meals;
create policy intake_meals_policy on public.intake_meals
for all using (
  public.is_admin() or exists (
    select 1
    from public.intake_days iday
    join public.patients p on p.id = iday.patient_id
    where iday.id = intake_meals.intake_day_id
      and (p.nutritionist_id = auth.uid() or p.profile_id = auth.uid())
  )
)
with check (
  public.is_admin() or exists (
    select 1
    from public.intake_days iday
    join public.patients p on p.id = iday.patient_id
    where iday.id = intake_meals.intake_day_id
      and (p.nutritionist_id = auth.uid() or p.profile_id = auth.uid())
  )
);

drop policy if exists intake_meal_items_policy on public.intake_meal_items;
create policy intake_meal_items_policy on public.intake_meal_items
for all using (
  public.is_admin() or exists (
    select 1
    from public.intake_meals im
    join public.intake_days iday on iday.id = im.intake_day_id
    join public.patients p on p.id = iday.patient_id
    where im.id = intake_meal_items.intake_meal_id
      and (p.nutritionist_id = auth.uid() or p.profile_id = auth.uid())
  )
)
with check (
  public.is_admin() or exists (
    select 1
    from public.intake_meals im
    join public.intake_days iday on iday.id = im.intake_day_id
    join public.patients p on p.id = iday.patient_id
    where im.id = intake_meal_items.intake_meal_id
      and (p.nutritionist_id = auth.uid() or p.profile_id = auth.uid())
  )
);

drop policy if exists progress_snapshots_policy on public.patient_progress_snapshots;
create policy progress_snapshots_policy on public.patient_progress_snapshots
for all using (
  public.is_admin() or exists (
    select 1 from public.patients p
    where p.id = patient_progress_snapshots.patient_id
      and (p.nutritionist_id = auth.uid() or p.profile_id = auth.uid())
  )
)
with check (
  public.is_admin() or exists (
    select 1 from public.patients p
    where p.id = patient_progress_snapshots.patient_id
      and p.nutritionist_id = auth.uid()
  )
);

drop policy if exists nutrient_reference_sets_read on public.nutrient_reference_sets;
create policy nutrient_reference_sets_read on public.nutrient_reference_sets
for select using (auth.role() = 'authenticated');

drop policy if exists nutrient_reference_sets_manage on public.nutrient_reference_sets;
create policy nutrient_reference_sets_manage on public.nutrient_reference_sets
for all using (public.is_admin() or public.is_nutritionist())
with check (public.is_admin() or public.is_nutritionist());

drop policy if exists nutrient_reference_values_read on public.nutrient_reference_values;
create policy nutrient_reference_values_read on public.nutrient_reference_values
for select using (auth.role() = 'authenticated');

drop policy if exists nutrient_reference_values_manage on public.nutrient_reference_values;
create policy nutrient_reference_values_manage on public.nutrient_reference_values
for all using (public.is_admin() or public.is_nutritionist())
with check (public.is_admin() or public.is_nutritionist());