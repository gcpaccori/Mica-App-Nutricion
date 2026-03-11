insert into public.dri_values (
  source_table, nutrient_key, nutrient_label, unit, value_type, value,
  life_stage_label, age_min_months, age_max_months, sex, condition, group_name, basis, special
) values
  ('total_water_and_macronutrients', 'carbohydrate', 'Carbohydrate', 'g/d', 'RDA_AI', 130, '19-30 y', 228, 371, 'female', null, 'Females', 'RDA_AI', null),
  ('total_water_and_macronutrients', 'total_fiber', 'Total Fiber', 'g/d', 'RDA_AI', 25, '19-30 y', 228, 371, 'female', null, 'Females', 'RDA_AI', null),
  ('total_water_and_macronutrients', 'fat', 'Fat', 'g/d', 'RDA_AI', 70, '19-30 y', 228, 371, 'female', null, 'Females', 'RDA_AI', null),
  ('total_water_and_macronutrients', 'protein', 'Protein', 'g/d', 'RDA_AI', 46, '19-30 y', 228, 371, 'female', null, 'Females', 'RDA_AI', null),
  ('elements_rda_ai', 'sodium', 'Sodium', 'g/d', 'RDA_AI', 1.5, '19-30 y', 228, 371, 'female', null, 'Females', 'RDA_AI', null),
  ('elements_rda_ai', 'potassium', 'Potassium', 'g/d', 'RDA_AI', 2.6, '19-30 y', 228, 371, 'female', null, 'Females', 'RDA_AI', null),
  ('elements_rda_ai', 'iron', 'Iron', 'mg/d', 'RDA_AI', 18, '19-30 y', 228, 371, 'female', null, 'Females', 'RDA_AI', null),
  ('vitamins_rda_ai', 'vitamin_a', 'Vitamin A', 'ug/d', 'RDA_AI', 700, '19-30 y', 228, 371, 'female', null, 'Females', 'RDA_AI', null),
  ('vitamins_rda_ai', 'vitamin_c', 'Vitamin C', 'mg/d', 'RDA_AI', 75, '19-30 y', 228, 371, 'female', null, 'Females', 'RDA_AI', null),
  ('vitamins_rda_ai', 'folate', 'Folate', 'ug/d', 'RDA_AI', 400, '19-30 y', 228, 371, 'female', null, 'Females', 'RDA_AI', null)
on conflict do nothing;
