-- SQL de lógica nutricional y porciones extraídas del workbook
-- Diseñado para integrarse con una tabla existente de alimentos.

create table if not exists nutrition_bmr_rule (
  id bigserial primary key,
  sex text not null check (sex in ('M','F')),
  age_min_years int not null,
  age_max_years int,
  weight_multiplier numeric(10,4) not null,
  kcal_constant numeric(10,4) not null,
  source_note text
);

create table if not exists nutrition_activity_level (
  id bigserial primary key,
  code text not null unique,
  label text not null,
  naf_min numeric(10,4),
  naf_max numeric(10,4),
  naf_reference numeric(10,4),
  source_note text
);

create table if not exists nutrition_meal_distribution_profile (
  id bigserial primary key,
  code text not null unique,
  label text not null
);

create table if not exists nutrition_meal_distribution_item (
  id bigserial primary key,
  profile_id bigint not null references nutrition_meal_distribution_profile(id) on delete cascade,
  sequence_no int not null,
  meal_code text not null,
  meal_label text not null,
  energy_pct numeric(10,4) not null
);

create table if not exists nutrition_micronutrient_reference (
  id bigserial primary key,
  sex text not null check (sex in ('M','F')),
  age_min_years int not null,
  age_max_years int,
  fiber_g numeric(10,2),
  calcium_mg numeric(10,2),
  iron_mg numeric(10,2),
  vitamin_a_ug numeric(10,2),
  vitamin_c_mg numeric(10,2),
  source_note text
);

-- Tabla staging de porciones. Luego puedes mapear food_name -> foods.id.
create table if not exists nutrition_food_portion_seed (
  id bigserial primary key,
  food_name text not null,
  portion_label text not null,
  net_grams numeric(10,3) not null,
  unique(food_name, portion_label, net_grams)
);

-- Si ya tienes foods(id, name), puedes usar esta tabla final:
create table if not exists nutrition_food_portion (
  id bigserial primary key,
  food_id bigint not null references foods(id) on delete cascade,
  portion_label text not null,
  net_grams numeric(10,3) not null,
  unique(food_id, portion_label, net_grams)
);

insert into nutrition_bmr_rule (sex, age_min_years, age_max_years, weight_multiplier, kcal_constant, source_note) values
('M',0,2,60.9,-54,'FAO/OMS/UNU image reference from workbook'),
('F',0,2,61.0,-51,'FAO/OMS/UNU image reference from workbook'),
('M',3,9,22.7,495,'FAO/OMS/UNU image reference from workbook'),
('F',3,9,22.5,499,'FAO/OMS/UNU image reference from workbook'),
('M',10,17,17.5,651,'FAO/OMS/UNU image reference from workbook'),
('F',10,17,12.2,746,'FAO/OMS/UNU image reference from workbook'),
('M',18,30,15.06,692.2,'FAO/OMS/UNU image reference from workbook'),
('F',18,30,14.8,486.6,'FAO/OMS/UNU image reference from workbook'),
('M',30,60,11.4,873.1,'FAO/OMS/UNU image reference from workbook'),
('F',30,60,8.13,845.6,'FAO/OMS/UNU image reference from workbook'),
('M',61,NULL,11.7,587.7,'FAO/OMS/UNU image reference from workbook'),
('F',61,NULL,9.08,658.5,'FAO/OMS/UNU image reference from workbook')
on conflict do nothing;

insert into nutrition_activity_level (code, label, naf_min, naf_max, naf_reference, source_note) values
('sedentary_light','Sedentaria o ligero',1.4,1.69,1.55,'Image reference from workbook'),
('moderate','Moderado',1.7,1.99,1.85,'Image reference from workbook'),
('active','Activo',2.0,2.4,2.2,'Image reference from workbook')
on conflict (code) do nothing;

insert into nutrition_meal_distribution_profile (code, label) values ('standard_5_meals_20_10_30_10_30','5 tiempos 20/10/30/10/30') on conflict (code) do nothing;

insert into nutrition_meal_distribution_item (profile_id, sequence_no, meal_code, meal_label, energy_pct)
select p.id, v.sequence_no, v.meal_code, v.meal_label, v.energy_pct
from nutrition_meal_distribution_profile p
join (values
(1,'breakfast','Desayuno',0.2),
(2,'snack_1','Merienda 1',0.1),
(3,'lunch','Almuerzo',0.3),
(4,'snack_2','Merienda 2',0.1),
(5,'dinner','Cena',0.3)
) as v(sequence_no, meal_code, meal_label, energy_pct) on true
where p.code = 'standard_5_meals_20_10_30_10_30'
on conflict do nothing;

insert into nutrition_micronutrient_reference (sex, age_min_years, age_max_years, fiber_g, calcium_mg, iron_mg, vitamin_a_ug, vitamin_c_mg, source_note) values
('F',15,15,26,1100,7.9,485,56,'Extracted from case sheet requirement row'),
('M',16,16,38,1100,7.7,630,63,'Extracted from case sheet requirement row')
on conflict do nothing;

-- Porciones extraídas del workbook
insert into nutrition_food_portion_seed (food_name, portion_label, net_grams) values
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
('Fresa',NULL,110.0),
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

-- Ejemplo de carga hacia la tabla final, si foods.name coincide exactamente con food_name:
-- insert into nutrition_food_portion (food_id, portion_label, net_grams)
-- select f.id, s.portion_label, s.net_grams
-- from nutrition_food_portion_seed s
-- join foods f on lower(trim(f.name)) = lower(trim(s.food_name))
-- on conflict do nothing;

-- Nota: en el workbook hay alias y pequeñas variaciones de texto en algunas medidas.
-- Conviene normalizar etiquetas como '1 porción aderezo' y '1 porción de aderezo' antes del match final.
