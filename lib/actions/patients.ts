"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const patientSchema = z.object({
  firstName: z.string().min(2, "Nombre invalido."),
  lastName: z.string().min(2, "Apellido invalido."),
  birthDate: z.string().min(1, "La fecha de nacimiento es obligatoria."),
  sex: z.enum(["male", "female", "other"]),
  activityLevel: z.enum(["sedentary", "light", "moderate", "high", "very_high"]),
  documentNumber: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email invalido.").optional().or(z.literal("")),
  occupation: z.string().optional(),
  allergies: z.string().optional(),
  intolerances: z.string().optional(),
  medicalNotes: z.string().optional(),
  lifestyleNotes: z.string().optional(),
});

function readOptional(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function buildPatientValues(formData: FormData) {
  const parsed = patientSchema.safeParse({
    firstName: readOptional(formData, "first_name"),
    lastName: readOptional(formData, "last_name"),
    birthDate: readOptional(formData, "birth_date"),
    sex: readOptional(formData, "sex"),
    activityLevel: readOptional(formData, "activity_level") || "sedentary",
    documentNumber: readOptional(formData, "document_number"),
    phone: readOptional(formData, "phone"),
    email: readOptional(formData, "email"),
    occupation: readOptional(formData, "occupation"),
    allergies: readOptional(formData, "allergies"),
    intolerances: readOptional(formData, "intolerances"),
    medicalNotes: readOptional(formData, "medical_notes"),
    lifestyleNotes: readOptional(formData, "lifestyle_notes"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "No se pudo validar el paciente.");
  }

  return parsed.data;
}

function patientPayload(values: z.infer<typeof patientSchema>) {
  return {
    first_name: values.firstName,
    last_name: values.lastName,
    birth_date: values.birthDate,
    sex: values.sex,
    activity_level: values.activityLevel,
    document_number: values.documentNumber || null,
    phone: values.phone || null,
    email: values.email || null,
    occupation: values.occupation || null,
    allergies: values.allergies || null,
    intolerances: values.intolerances || null,
    medical_notes: values.medicalNotes || null,
    lifestyle_notes: values.lifestyleNotes || null,
  };
}

export async function createPatientAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    redirect("/patients?message=Configura%20Supabase%20antes%20de%20crear%20pacientes.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?message=Inicia%20sesion%20para%20continuar.");
  }

  let values: z.infer<typeof patientSchema>;

  try {
    values = buildPatientValues(formData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo validar el paciente.";
    redirect(`/patients?message=${encodeURIComponent(message)}`);
  }

  const { error } = await supabase.from("patients").insert({
    nutritionist_id: user.id,
    ...patientPayload(values),
  });

  if (error) {
    redirect(`/patients?message=${encodeURIComponent(error.message)}`);
  }

  redirect("/patients?message=Paciente%20creado%20correctamente.");
}

export async function updatePatientAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    redirect("/patients?message=Configura%20Supabase%20antes%20de%20editar%20pacientes.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?message=Inicia%20sesion%20para%20continuar.");
  }

  const patientId = readOptional(formData, "id");

  if (!patientId) {
    redirect(`/patients?message=${encodeURIComponent("Falta el identificador del paciente.")}`);
  }

  let values: z.infer<typeof patientSchema>;

  try {
    values = buildPatientValues(formData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo validar el paciente.";
    redirect(`/patients?edit=${patientId}&message=${encodeURIComponent(message)}`);
  }

  const { error } = await supabase
    .from("patients")
    .update(patientPayload(values))
    .eq("id", patientId);

  if (error) {
    redirect(`/patients?edit=${patientId}&message=${encodeURIComponent(error.message)}`);
  }

  redirect(`/patients?message=${encodeURIComponent("Paciente actualizado correctamente.")}`);
}

export async function deletePatientAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    redirect("/patients?message=Configura%20Supabase%20antes%20de%20eliminar%20pacientes.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?message=Inicia%20sesion%20para%20continuar.");
  }

  const patientId = readOptional(formData, "id");

  if (!patientId) {
    redirect(`/patients?message=${encodeURIComponent("Falta el identificador del paciente.")}`);
  }

  const { error } = await supabase.from("patients").delete().eq("id", patientId);

  if (error) {
    redirect(`/patients?edit=${patientId}&message=${encodeURIComponent(error.message)}`);
  }

  redirect(`/patients?message=${encodeURIComponent("Paciente eliminado correctamente.")}`);
}