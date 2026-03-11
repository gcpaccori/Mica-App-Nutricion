export type FoodField = {
  key: string;
  label: string;
  shortLabel: string;
  type: "text" | "number";
  step?: string;
  required?: boolean;
  section: "base" | "macro" | "fatty" | "minerals" | "vitamins";
};

export const FOOD_FIELDS: FoodField[] = [
  { key: "grupo_numero", label: "Grupo número", shortLabel: "Grupo #", type: "number", step: "1", required: true, section: "base" },
  { key: "grupo_nombre", label: "Grupo nombre", shortLabel: "Grupo", type: "text", required: true, section: "base" },
  { key: "grupo_slug", label: "Grupo slug", shortLabel: "Slug", type: "text", required: true, section: "base" },
  { key: "alimento", label: "Alimento", shortLabel: "Alimento", type: "text", required: true, section: "base" },
  { key: "valor_energetico_kcal", label: "Valor energético kcal", shortLabel: "Kcal", type: "number", step: "0.01", section: "base" },
  { key: "agua_g", label: "Agua g", shortLabel: "Agua", type: "number", step: "0.01", section: "base" },
  { key: "proteinas_g", label: "Proteínas g", shortLabel: "Prot", type: "number", step: "0.01", section: "macro" },
  { key: "lipidos_totales_g", label: "Lípidos totales g", shortLabel: "Líp", type: "number", step: "0.01", section: "macro" },
  { key: "colesterol_mg", label: "Colesterol mg", shortLabel: "Coles", type: "number", step: "0.01", section: "macro" },
  { key: "acidos_grasos_saturados_g", label: "Ácidos grasos saturados g", shortLabel: "Sat", type: "number", step: "0.01", section: "fatty" },
  { key: "monoinsaturados_g", label: "Monoinsaturados g", shortLabel: "Mono", type: "number", step: "0.01", section: "fatty" },
  { key: "polininsaturados_g", label: "Poliinsaturados g", shortLabel: "Poli", type: "number", step: "0.01", section: "fatty" },
  { key: "trans_g", label: "Trans g", shortLabel: "Trans", type: "number", step: "0.01", section: "fatty" },
  { key: "acido_18_2_cis_linoleico_g", label: "Ácido 18:2 cis linoleico g", shortLabel: "18:2", type: "number", step: "0.01", section: "fatty" },
  { key: "acido_18_3_cis_alfa_linolenico_ala_g", label: "Ácido 18:3 cis alfa linolénico ALA g", shortLabel: "18:3 ALA", type: "number", step: "0.01", section: "fatty" },
  { key: "acido_20_4_araquidonico_g", label: "Ácido 20:4 araquidónico g", shortLabel: "20:4 ARA", type: "number", step: "0.01", section: "fatty" },
  { key: "acido_20_5_n_3_eicosapentaenoico_epa_g", label: "Ácido 20:5 n-3 EPA g", shortLabel: "EPA", type: "number", step: "0.01", section: "fatty" },
  { key: "acido_22_6_n_3_docosahexaenoico_dha_g", label: "Ácido 22:6 n-3 DHA g", shortLabel: "DHA", type: "number", step: "0.01", section: "fatty" },
  { key: "carbohidratos_disponibles_g", label: "Carbohidratos disponibles g", shortLabel: "CHO disp", type: "number", step: "0.01", section: "macro" },
  { key: "carbohidratos_totales_g", label: "Carbohidratos totales g", shortLabel: "CHO tot", type: "number", step: "0.01", section: "macro" },
  { key: "azucar_total_g", label: "Azúcar total g", shortLabel: "Az tot", type: "number", step: "0.01", section: "macro" },
  { key: "azucar_agregado_g", label: "Azúcar agregado g", shortLabel: "Az agr", type: "number", step: "0.01", section: "macro" },
  { key: "fibra_alimentaria_g", label: "Fibra alimentaria g", shortLabel: "Fibra", type: "number", step: "0.01", section: "macro" },
  { key: "alcohol_g", label: "Alcohol g", shortLabel: "Alcohol", type: "number", step: "0.01", section: "macro" },
  { key: "cenizas_g", label: "Cenizas g", shortLabel: "Cenizas", type: "number", step: "0.01", section: "macro" },
  { key: "sodio_mg", label: "Sodio mg", shortLabel: "Na", type: "number", step: "0.01", section: "minerals" },
  { key: "potasio_mg", label: "Potasio mg", shortLabel: "K", type: "number", step: "0.01", section: "minerals" },
  { key: "calcio_mg", label: "Calcio mg", shortLabel: "Ca", type: "number", step: "0.01", section: "minerals" },
  { key: "cobre_mg", label: "Cobre mg", shortLabel: "Cu", type: "number", step: "0.01", section: "minerals" },
  { key: "fosforo_mg", label: "Fósforo mg", shortLabel: "P", type: "number", step: "0.01", section: "minerals" },
  { key: "hierro_mg", label: "Hierro mg", shortLabel: "Fe", type: "number", step: "0.01", section: "minerals" },
  { key: "magnesio_mg", label: "Magnesio mg", shortLabel: "Mg", type: "number", step: "0.01", section: "minerals" },
  { key: "zinc_mg", label: "Zinc mg", shortLabel: "Zn", type: "number", step: "0.01", section: "minerals" },
  { key: "niacina_mg", label: "Niacina mg", shortLabel: "Niac", type: "number", step: "0.01", section: "vitamins" },
  { key: "folato_efd_ug", label: "Folato EFD ug", shortLabel: "Fol EFD", type: "number", step: "0.01", section: "vitamins" },
  { key: "acido_folico_ug", label: "Ácido fólico ug", shortLabel: "Fol ac", type: "number", step: "0.01", section: "vitamins" },
  { key: "vitamina_a_rae_ug", label: "Vitamina A RAE ug", shortLabel: "Vit A", type: "number", step: "0.01", section: "vitamins" },
  { key: "retinol_ug", label: "Retinol ug", shortLabel: "Retinol", type: "number", step: "0.01", section: "vitamins" },
  { key: "tiamina_mg", label: "Tiamina mg", shortLabel: "B1", type: "number", step: "0.01", section: "vitamins" },
  { key: "riboflavina_mg", label: "Riboflavina mg", shortLabel: "B2", type: "number", step: "0.01", section: "vitamins" },
  { key: "vitamina_b_12_ug", label: "Vitamina B12 ug", shortLabel: "B12", type: "number", step: "0.01", section: "vitamins" },
  { key: "vitamina_c_mg", label: "Vitamina C mg", shortLabel: "Vit C", type: "number", step: "0.01", section: "vitamins" },
  { key: "vitamina_d_ug", label: "Vitamina D ug", shortLabel: "Vit D", type: "number", step: "0.01", section: "vitamins" },
];

export const FOOD_TABLE_COLUMNS = [
  { key: "id", label: "ID", shortLabel: "ID" },
  ...FOOD_FIELDS.map(({ key, label, shortLabel }) => ({ key, label, shortLabel })),
];

export const FOOD_FORM_SECTIONS: Array<{ key: FoodField["section"]; title: string }> = [
  { key: "base", title: "Base" },
  { key: "macro", title: "Macronutrientes" },
  { key: "fatty", title: "Perfil graso" },
  { key: "minerals", title: "Minerales" },
  { key: "vitamins", title: "Vitaminas" },
];