create or replace function public.normalize_portion_text(input text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(lower(trim(coalesce(input, ''))), '\s+', ' ', 'g'), '');
$$;

create table if not exists public.nutrition_food_portion_seed (
  id bigserial primary key,
  food_name text not null,
  portion_label text,
  net_grams numeric(10,3) not null check (net_grams > 0),
  portion_label_normalized text generated always as (
    coalesce(public.normalize_portion_text(portion_label), 'porcion workbook sin etiqueta')
  ) stored,
  unique(food_name, portion_label, net_grams)
);

create index if not exists nutrition_food_portion_seed_food_name_idx
on public.nutrition_food_portion_seed (food_name);

create table if not exists public.nutrition_food_portion (
  id bigserial primary key,
  alimento_id bigint not null references public.alimentos_26_grupos(id) on delete cascade,
  portion_label text not null,
  portion_label_normalized text not null,
  net_grams numeric(10,3) not null check (net_grams > 0),
  source text not null default 'workbook',
  created_at timestamptz not null default now(),
  unique(alimento_id, portion_label_normalized, net_grams)
);

create index if not exists nutrition_food_portion_alimento_idx
on public.nutrition_food_portion (alimento_id, portion_label_normalized);

alter table public.diet_meal_items
add column if not exists food_portion_id bigint references public.nutrition_food_portion(id) on delete set null;

alter table public.diet_meal_items
add column if not exists portion_multiplier numeric(12,3) not null default 1 check (portion_multiplier > 0);

create index if not exists diet_meal_items_food_portion_id_idx
on public.diet_meal_items (food_portion_id);

alter table public.intake_meal_items
add column if not exists food_portion_id bigint references public.nutrition_food_portion(id) on delete set null;

alter table public.intake_meal_items
add column if not exists portion_multiplier numeric(12,3) not null default 1 check (portion_multiplier > 0);

create index if not exists intake_meal_items_food_portion_id_idx
on public.intake_meal_items (food_portion_id);

insert into public.nutrition_food_portion_seed (food_name, portion_label, net_grams) values
('Huevo de gallina entero, crudo','1 unidad mediana',44.0),
('Brócoli','5 ramitas medianas',25.0),
('Queso fresco de vaca','2 tajadas pequeñas delgadas',23.0),
('Aceite vegetal de girasol','1 cucharadita llena',2.4),
('Durazno-Melocotón','1 unidad pequeña',52.0),
('Avena, hojuela cruda','2 cucharadas colmadas',20.0),
('Cañihua, harina de','1 cucharada llena',13.0),
('Leche evaporada entera','7 cucharaditas llenas',22.0),
('Kiwicha, harina de','2 cucharaditas llenas',10.0),
('Papaya','1/2 tajada de unidad pequeña',95.0),
('Canela, molida*','1 cucharadita al ras',4.0),
('Almendra','5 unidades mediana',6.0),
('Ajo sin cáscara','1 diente',1.0),
('Ají amarillo molido fresco sin sal','4 cucharaditas al ras',12.0),
('Cebolla de cabeza','2 cucharadas colmadas',57.0),
('Pimienta negra','1 cucharadita',3.0),
('Culantro sin tallo','1 cucharadita',3.0),
('Aceite vegetal de girasol','1 porción aderezo',5.0),
('Yuca blanca fresca sin cáscara','1/2 trozo mediano',86.0),
('Arroz blanco corriente','1 porción mediana',80.0),
('Aceite vegetal de girasol','1 cucharada llena',6.4),
('Lechuga de seda','2 hojas',22.0),
('Zanahoria','3 rodajas grandes',34.0),
('Brócoli','4 ramitas medianas',20.0),
('Limón, jugo de','1 cucharadita',5.0),
('Manzana delicia roja con cáscara','1 unidad pequeña',100.0),
('Canela, molida*','1 cucharadita',3.0),
('Pavo, carne de','1/2 filete pequeño',40.0),
('Palta “fuerte”','1 tajada de unidad mediana',30.0),
('Lechuga de seda','1 hoja',11.0),
('Tomate','1 rodaja',40.0),
('Siete harinas (trigo, habas, arvejas, kiwicha, cañihua, cebada, quinua)','1 cucharada llena',13.0),
('Chirimoya','1/2 unidad mediana',75.0),
('Lima','1 unidad mediana',71.0),
('Papa blanca','1 unidad pequeña',134.0),
('Arveja, fresca sin vaina','1 porción para guiso',8.0),
('Cebolla de cabeza','1 cucharadita colmada',12.0),
('Ají colorado molido','4 cucharaditas al ras',12.0),
('Pimienta negra','1 cucharadita al ras',4.0),
('Perejil sin tallo','1 cucharadita',3.0),
('Brócoli','7 ramitas grandes',50.0),
('Rabanitos','3 unidades pequeñas',77.0),
('Plátano de isla','1 unidad pequeña',67.0),
('Sachapapa','1 unidad pequeña',134.0),
('Tomate','2 rodajas',40.0),
('Queso fresco de vaca','1 tajada grande delgada',30.0),
('Semilla de ajonjolí*','1 cucharadita al ras',4.0),
('Aceite vegetal de olivo','1 cucharadita llena',2.4),
('Quinua, harina de','1 cucharada llena',13.0),
('Uva borgoña','10 unidades medianas',64.0),
('Queso fresco de vaca','2 tajadas medianas delgadas',23.0),
('Fresa',null,110.0),
('Garbanzo','1 cucharada colmada',20.0),
('Papa blanca','1/2 unidad pequeña',65.0),
('Tomate','1 rodaja mediana',18.0),
('Pera nacional','1/2 unidad mediana',93.0),
('Kiwi, sin cáscara','1 unidad mediana',100.0),
('Mantequilla de almendras','1 cucharadita',5.0),
('Quinua, hojuelas de','2 cucharadas colmadas',20.0),
('Kiwicha, harina de','1 cucharada llena',13.0),
('Chía, semilla de','1 cucharada',10.0),
('Tuna','1 unidad mediana',80.0),
('Camote amarillo sin cáscara','4 rodajas medianas',80.0),
('Margarina, Dorina Light al 50% de grasa','2 cucharaditas al ras',4.0),
('Col crespa o repollo, sin cogollo','2 hojas',22.0),
('Papaya','1 tajada de unidad de pequeña',182.0),
('Canela, molida*','1 cucharadita',4.0),
('Pescado sardina, fresco','2 unidades grandes',48.0),
('Semilla de ajonjolí*','2 cucharaditas',8.0),
('Tomate','1 rodaja',20.0),
('Manzana delicia roja con cáscara','1 unidad pequeña',90.0),
('Semilla de ajonjoli negro','1 cucharadita ',4.0),
('Betarraga','1/3 unidad pequeña',22.0),
('Limón, jugo de','2 cucharaditas llenas',10.0),
('Pan de molde','2 tajadas',40.0),
('Ajo sin cáscara','3 dientes',3.0),
('Aceite vegetal de girasol','1 porción de aderezo',5.0),
('Yuca amarilla fresca sin cáscara','1 trozo pequeño',41.0),
('Piña','1 rodaja mediana',150.0),
('Trigo, harina fortificada con hierro de','1 cucharada llena',12.0),
('Aguaymanto','10 unidades medianas',48.0),
('Manzana delicia roja con cáscara','1/2 unidad mediana',74.0),
('Almendra','4 unidades medianos',4.8),
('Avena, hojuela cruda','2 cucharadas colmadas',15.0),
('Uva italia','11 unidades medianos',71.0),
('Pimiento rojo','5 tiras',15.0),
('Papa amarilla sin cáscara','1 rodaja grande',55.0),
('Brócoli','7 ramitas medianas',35.0),
('Limón, jugo de','1 cucharadita llena',5.0),
('Mango','1 unidad mediana',85.0),
('Nuez moscada, molida*','1 cucharadita',3.0),
('Espinaca negra sin tronco','2 hojas',22.0),
('Aceite vegetal de girasol','2 cucharaditas llenas',4.8),
('Quinua, harina de','1 cucharada llena',12.0),
('Leche evaporada entera','1/4 taza mediana',62.5),
('Tuna','1 unidad pequeña',59.0),
('Granadilla','1 unidad grande',79.0),
('Canela, molida*','1 pizca',1.0),
('Chía, semilla de','1 cucharadita',3.0),
('Mantequilla de maní','1 cucharadita',5.0),
('Leche evaporada entera','7 cucharaditas llenas',25.0),
('Pan francés fortificado con hierro','1/3 unidad',10.0),
('Cebolla de cabeza','2 cucharadas llenas',37.0),
('Arroz blanco corriente','1 porción grande',100.0),
('Aceite vegetal de girasol','1 porción para arroz',8.0),
('Papa blanca','1/2 unidad mediana',98.0),
('Col de “Bruselas”','5 unidades',22.0),
('Alcachofa','1/2 unidad mediana',47.5),
('Pera de agua','1 unidad pequeña',120.0),
('Almendra','8 almendras medianas',10.0),
('Trigo, harina fortificada con hierro de','1 cucharada colmada',20.0),
('Huevo de gallina entero, crudo','1 unidad grande',55.0),
('Zanahoria','6 rodajas grandes',67.8),
('Plátano de seda','1/2 unidad grande',80.7),
('Almendra','5 unidades medianas',6.0),
('Cañihua, hojuela de','2 cucharadas colmadas',20.0),
('Kiwicha, harina de','1 cucharada llena',12.0),
('Pollo, carne pulpa','1/2 unidad pequeña',36.0),
('Naranja de Huando','1 unidad grande',80.0),
('Romero fresco*','1 cucharadita',3.0),
('Cominos','1 cucharadita',3.0),
('Tomillo seco*','1 cucharadita',3.0),
('Frejol canario','4 cucharaditas llenas',30.0),
('Yuca blanca fresca sin cáscara','1 trozo pequeño',70.0),
('Pan de molde','1 tajada',20.0),
('Fresa','3 unidades medianas',34.2),
('Pescado atún, enlatado en agua','1/2 lata',50.0),
('Pimienta negra','1 cucharadita  al ras',4.0),
('Apio, tallo sin hojas','3 ramas',33.0),
('Papa amarilla sin cáscara','1/2 unidad pequeña',40.0),
('Siete harinas (trigo, habas, arvejas, kiwicha, cañihua, cebada, quinua)','1 cucharada llena',12.0),
('Kiwi, sin cáscara','1 unidad mediana',85.0),
('Apio, tallo sin hojas','3 ramitas',33.0),
('Res, hígado de','1 unidad mediana',100.0),
('Espinaca negra sin tronco','3 hojas',33.0),
('Albahaca sin tallo','2 cucharaditas',6.0),
('Camote amarillo sin cáscara','1 unidad pequeña',149.0),
('Chirimoya','1/2 unidad mediana',80.0),
('Mantequilla de maní','2 cucharaditas al ras',8.0),
('Pollo, molleja, cruda*','2 unidades medianas',58.0),
('Pera chilena','1 unidad pequeña',100.0),
('Palta','1 tajada de unidad mediana',30.0),
('Aguaymanto','15 unidades medianas',72.0),
('Huevo de gallina entero, crudo','1/2 unidad mediana',22.0),
('Trigo, harina fortificada con hierro de','1 cucharada al ras',6.0),
('Tomate','1/2 unidad pequeña',48.0),
('Cebolla de cabeza','1 cucharada colmada',12.0),
('Albahaca sin tallo','1 cucharadita',3.0),
('Queso fresco de vaca','1/2 tajada grande delgada',15.0),
('Papa blanca','1/2 unidad pequeña',60.0),
('Alcachofa','1 unidad mediana',95.0),
('Uva negra','6 unidades grandes',50.0),
('Acelga, hojas de (sin tallo)','2 hojas',22.0),
('Kiwi, sin cáscara','1 unidad mediana',80.0),
('Chía, semilla de','2 cucharaditas llenas',10.0),
('Nuez moscada, molida*','1 cucharadita',5.0),
('Plátano de seda','1 unidad pequeña',65.7),
('Tomillo seco*','1 cucharadita al ras',4.0),
('Cominos','1 pizca',1.0),
('Esparragos','3 unidades',75.0),
('Camote amarillo sin cáscara','5 rodajas medianas',105.0),
('Margarina, Dorina Light al 50% de grasa','2 cucharaditas al ras',5.0),
('Avena, hojuela cruda','3 cucharaditas colmadas',13.0),
('Res, hígado de','1/2 unidad mediana',50.0),
('Cebolla de cabeza','2 cucharadas llenas',20.0),
('Palta','1 tajada',30.0),
('Jamón del país','1 rebanada',15.0),
('Mandarina','1 unidad pequeña',58.0),
('Lentejas chicas','6 cucharaditas llenas',35.0),
('Cebolla de cabeza','1 cuchatadita colmada',12.0),
('Tomate','1 rodaja pequeña',12.0),
('Yuca amarilla fresca sin cáscara','1 trozo pequeño',82.0),
('Lechuga americana','2 hojas',22.0),
('Kiwi, sin cáscara','1/2 unidad pequeña',35.0)
on conflict do nothing;

insert into public.nutrition_food_portion (alimento_id, portion_label, portion_label_normalized, net_grams, source)
select
  food.id,
  coalesce(seed.portion_label, 'Porcion workbook sin etiqueta') as portion_label,
  seed.portion_label_normalized,
  seed.net_grams,
  'workbook'
from public.nutrition_food_portion_seed seed
join public.alimentos_26_grupos food
  on public.normalize_portion_text(food.alimento) = public.normalize_portion_text(seed.food_name)
on conflict (alimento_id, portion_label_normalized, net_grams) do nothing;

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
  public.scale_nutrient(food.vitamina_d_ug, dmi.quantity_grams) as vitamin_d_ug,
  dmi.food_portion_id,
  dmi.portion_multiplier,
  dmi.household_measure,
  dmi.household_quantity,
  fp.portion_label as saved_portion_label
from public.diet_meal_items dmi
join public.alimentos_26_grupos food on food.id = dmi.alimento_id
left join public.nutrition_food_portion fp on fp.id = dmi.food_portion_id;

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
  public.scale_nutrient(food.vitamina_d_ug, imi.quantity_grams) as vitamin_d_ug,
  imi.food_portion_id,
  imi.portion_multiplier,
  imi.household_measure,
  imi.household_quantity,
  fp.portion_label as saved_portion_label
from public.intake_meal_items imi
join public.alimentos_26_grupos food on food.id = imi.alimento_id
left join public.nutrition_food_portion fp on fp.id = imi.food_portion_id;