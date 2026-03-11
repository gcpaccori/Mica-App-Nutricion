"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

function str(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}

function intakeDayRedirect(patientId: string, message: string, extra?: string) {
  const suffix = extra ? `&${extra}` : "";
  return `/patients/${patientId}?tab=intake${suffix}&message=${encodeURIComponent(message)}`;
}

export async function createIntakeDayAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const patientId = str(formData, "patient_id");
  const planId = str(formData, "plan_id") || null;
  const intakeDate = str(formData, "intake_date");

  if (!patientId || !intakeDate) {
    redirect(intakeDayRedirect(patientId, "Paciente y fecha son obligatorios."));
  }

  const { data: day, error } = await supabase.from("intake_days").insert({
    patient_id: patientId,
    plan_id: planId,
    intake_date: intakeDate,
  }).select("id").single();

  if (error) {
    redirect(intakeDayRedirect(patientId, error.message));
  }

  redirect(`/intake/${day.id}?message=${encodeURIComponent("Dia de consumo creado.")}`);
}

export async function updateIntakeDayAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const intakeDayId = str(formData, "id");
  const patientId = str(formData, "patient_id");
  const planId = str(formData, "plan_id") || null;
  const intakeDate = str(formData, "intake_date");

  if (!intakeDayId) {
    redirect(intakeDayRedirect(patientId, "Falta el identificador del día de consumo."));
  }

  if (!patientId || !intakeDate) {
    redirect(intakeDayRedirect(patientId, "Paciente y fecha son obligatorios.", `editIntake=${intakeDayId}`));
  }

  const { error } = await supabase
    .from("intake_days")
    .update({
      patient_id: patientId,
      plan_id: planId,
      intake_date: intakeDate,
    })
    .eq("id", intakeDayId)
    .eq("patient_id", patientId);

  if (error) {
    redirect(intakeDayRedirect(patientId, error.message, `editIntake=${intakeDayId}`));
  }

  redirect(intakeDayRedirect(patientId, "Dia de consumo actualizado correctamente."));
}

export async function deleteIntakeDayAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const intakeDayId = str(formData, "id");
  const patientId = str(formData, "patient_id");

  if (!intakeDayId) {
    redirect(intakeDayRedirect(patientId, "Falta el identificador del día de consumo."));
  }

  const { error } = await supabase
    .from("intake_days")
    .delete()
    .eq("id", intakeDayId)
    .eq("patient_id", patientId);

  if (error) {
    redirect(intakeDayRedirect(patientId, error.message, `editIntake=${intakeDayId}`));
  }

  redirect(intakeDayRedirect(patientId, "Dia de consumo eliminado correctamente."));
}

export async function addIntakeMealAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const intakeDayId = str(formData, "intake_day_id");
  const mealTypeId = Number(str(formData, "meal_type_id"));
  const intakeDayIdForRedirect = str(formData, "intake_day_id");
  const visibleNameInput = str(formData, "visible_name");
  const menuTextInput = str(formData, "menu_text");

  const { data: mealType } = await supabase
    .from("meal_types")
    .select("name")
    .eq("id", mealTypeId)
    .maybeSingle();

  const { error } = await supabase.from("intake_meals").insert({
    intake_day_id: intakeDayId,
    meal_type_id: mealTypeId,
    visible_name: visibleNameInput || mealType?.name || null,
    menu_text: menuTextInput || null,
    status: "planned",
  });

  if (error) {
    redirect(`/intake/${intakeDayIdForRedirect}?message=${encodeURIComponent(error.message)}`);
  }

  redirect(`/intake/${intakeDayIdForRedirect}`);
}

export async function updateIntakeMealPresentationAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const intakeMealId = str(formData, "intake_meal_id");
  const intakeDayId = str(formData, "intake_day_id");
  const visibleName = str(formData, "visible_name");
  const menuText = str(formData, "menu_text");

  const { error } = await supabase
    .from("intake_meals")
    .update({
      visible_name: visibleName || null,
      menu_text: menuText || null,
    })
    .eq("id", intakeMealId);

  if (error) {
    redirect(`/intake/${intakeDayId}?message=${encodeURIComponent(error.message)}`);
  }

  redirect(`/intake/${intakeDayId}?message=${encodeURIComponent("Presentacion de la comida actualizada.")}`);
}

export async function addIntakeItemAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const intakeMealId = str(formData, "intake_meal_id");
  const alimentoId = Number(str(formData, "alimento_id"));
  const quantityGramsInput = Number(str(formData, "quantity_grams"));
  const intakeDayId = str(formData, "intake_day_id");
  const consumed = str(formData, "consumed") !== "false";
  const foodPortionId = Number(str(formData, "food_portion_id"));
  const portionMultiplier = Number(str(formData, "portion_multiplier")) || 1;
  let quantityGrams = quantityGramsInput;
  let householdMeasure = str(formData, "household_measure") || null;
  let householdQuantity = foodPortionId ? portionMultiplier : null;

  if (foodPortionId) {
    const { data: portion } = await supabase
      .from("nutrition_food_portion")
      .select("id, alimento_id, portion_label, net_grams")
      .eq("id", foodPortionId)
      .eq("alimento_id", alimentoId)
      .single();

    if (!portion) {
      redirect(`/intake/${intakeDayId}?message=${encodeURIComponent("La porcion seleccionada ya no existe para este alimento.")}`);
    }

    quantityGrams = Number(portion.net_grams) * portionMultiplier;
    householdMeasure = portion.portion_label;
    householdQuantity = portionMultiplier;
  }

  if (!alimentoId || !quantityGrams || quantityGrams <= 0) {
    redirect(`/intake/${intakeDayId}?message=${encodeURIComponent("Alimento y gramos son obligatorios.")}`);
  }

  const { error } = await supabase.from("intake_meal_items").insert({
    intake_meal_id: intakeMealId,
    alimento_id: alimentoId,
    quantity_grams: quantityGrams,
    household_measure: householdMeasure,
    household_quantity: householdQuantity,
    food_portion_id: foodPortionId || null,
    portion_multiplier: foodPortionId ? portionMultiplier : 1,
    consumed,
  });

  if (error) {
    redirect(`/intake/${intakeDayId}?message=${encodeURIComponent(error.message)}`);
  }

  redirect(`/intake/${intakeDayId}`);
}

export async function updateMealStatusAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/sign-in");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const intakeMealId = str(formData, "intake_meal_id");
  const status = str(formData, "status");
  const intakeDayId = str(formData, "intake_day_id");

  const { error } = await supabase
    .from("intake_meals")
    .update({ status })
    .eq("id", intakeMealId);

  if (error) {
    redirect(`/intake/${intakeDayId}?message=${encodeURIComponent(error.message)}`);
  }

  redirect(`/intake/${intakeDayId}`);
}
