import Link from "next/link";
import { redirect } from "next/navigation";

import { FormModalShell } from "@/components/form-modal-shell";
import {
  createPatientAction,
  deletePatientAction,
  updatePatientAction,
} from "@/lib/actions/patients";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type RoleRelation = { code?: string | null } | Array<{ code?: string | null }> | null;
type PatientRow = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  sex: string;
  activity_level?: string | null;
  phone?: string | null;
  email?: string | null;
  document_number?: string | null;
  occupation?: string | null;
  allergies?: string | null;
  intolerances?: string | null;
  medical_notes?: string | null;
  lifestyle_notes?: string | null;
  created_at: string;
};

function getMessage(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const editId = getMessage(params?.edit);
  const mode = getMessage(params?.mode);

  if (!hasSupabaseEnv()) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-12 lg:px-10">
        <div className="panel rounded-[2rem] p-8 text-slate-700">
          Completa el archivo .env.local para activar el modulo de pacientes.
        </div>
      </main>
    );
  }

  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    redirect("/sign-in");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [{ data: profile }, { data: roleRows }, { data: patients, error }] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabase
        .from("user_roles")
        .select("roles(code, name)")
        .eq("user_id", user.id),
      supabase
        .from("patients")
        .select(
          "id, first_name, last_name, birth_date, sex, activity_level, phone, email, document_number, occupation, allergies, intolerances, medical_notes, lifestyle_notes, created_at",
        )
        .order("created_at", { ascending: false }),
    ]);

  const selectedPatient = ((patients ?? []) as PatientRow[]).find((patient) => patient.id === editId) ?? null;

  const roles =
    roleRows
      ?.flatMap((row) => {
        const relation = row.roles as RoleRelation;

        if (Array.isArray(relation)) {
          return relation.map((item) => item?.code).filter(Boolean);
        }

        return relation?.code ? [relation.code] : [];
      })
      .filter(Boolean) ?? [];

  const canCreate = roles.includes("admin") || roles.includes("nutritionist") || !roles.length;
  const patientFormAction = selectedPatient ? updatePatientAction : createPatientAction;
  const showPatientModal = Boolean(selectedPatient) || mode === "create";
  const closePatientModalHref = "/patients";

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10 lg:py-14">
      <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
        <div className="panel-strong self-start rounded-[2rem] p-8 lg:p-10">
          <p className="eyebrow">Ficha clinica</p>
          <h1 className="headline mt-4 text-4xl leading-tight text-slate-950 md:text-5xl">
            Pacientes de {profile?.full_name ?? user.email ?? "la consulta"}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
            Esta primera pantalla fija al paciente como centro de todo el flujo.
            Desde aqui ya puedes registrar identificacion, contexto, actividad,
            alergias, intolerancias y notas clinicas iniciales.
          </p>
        </div>

        <div className="panel self-start rounded-[2rem] p-8">
          <p className="eyebrow">Roles detectados</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {roles.length ? (
              roles.map((role) => (
                <span
                  key={role}
                  className="rounded-full bg-[#d6ebe3] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#0f5c4d]"
                >
                  {role}
                </span>
              ))
            ) : (
              <span className="rounded-full bg-[#fff3db] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#9a5a1f]">
                Usa nutritionist o admin para alta clinica
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr] xl:items-start">
        <div className="panel self-start rounded-[2rem] p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Acciones de ficha</p>
              <p className="mt-2 text-sm text-slate-500">
                Crear y editar la ficha base ahora salen como modales responsivos para acelerar el flujo sin dejar formularios gigantes siempre visibles.
              </p>
            </div>
          </div>
          {canCreate ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/patients?mode=create" className="rounded-full bg-[#0f5c4d] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0a4a3d]">
                Nuevo paciente
              </Link>
              {selectedPatient ? (
                <span className="rounded-[1rem] bg-[#f1f7f4] px-4 py-3 text-sm text-slate-700">
                  Editando a {selectedPatient.first_name} {selectedPatient.last_name}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 rounded-[1.5rem] bg-[#fff3db] p-4 text-sm text-[#9a5a1f]">
              Tu rol actual no permite crear pacientes.
            </div>
          )}
        </div>

        <div className="panel self-start rounded-[2rem] p-8">
          <p className="eyebrow">Listado actual</p>
          <div className="mt-5 space-y-4">
            {error ? (
              <div className="rounded-[1.5rem] bg-[#fff3db] p-4 text-sm text-[#9a5a1f]">
                {error.message}
              </div>
            ) : patients?.length ? (
              patients.map((patient) => (
                <div key={patient.id} className="rounded-[1.5rem] border border-[#0f5c4d]/10 bg-white/80 p-5 transition hover:border-[#0f5c4d]/30 hover:shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-950">
                        {patient.first_name} {patient.last_name}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {patient.sex} · {patient.activity_level ?? "sedentary"}
                      </p>
                    </div>
                    <div className="text-right text-sm text-slate-500">
                      <p>{patient.birth_date}</p>
                      <p>{patient.email ?? patient.phone ?? "Sin contacto"}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
                    <Link href={`/patients/${patient.id}`} className="text-[#0f5c4d] hover:underline">
                      Ver ficha clinica →
                    </Link>
                    <Link href={`/patients?edit=${patient.id}`} className="text-slate-600 hover:text-slate-950 hover:underline">
                      Editar ficha base
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-[#0f5c4d]/20 bg-white/80 p-5 text-sm text-slate-600">
                Aun no hay pacientes cargados. Empieza por la ficha clinica minima.
              </div>
            )}
          </div>
        </div>
      </section>

      {showPatientModal && canCreate ? (
        <FormModalShell
          title={selectedPatient ? "Editar paciente" : "Nuevo paciente"}
          eyebrow="Ficha clínica"
          description={selectedPatient
            ? "Actualiza la ficha base o elimina el paciente si corresponde."
            : "Crea la ficha clínica base con identificación, contexto y notas iniciales."}
          closeHref={closePatientModalHref}
          widthClassName="max-w-6xl"
        >
          {selectedPatient ? (
            <div className="mb-5 rounded-[1.25rem] bg-[#f1f7f4] px-4 py-3 text-sm text-slate-700">
              Editando a {selectedPatient.first_name} {selectedPatient.last_name}
            </div>
          ) : null}

          <form action={patientFormAction} className="grid gap-4 md:grid-cols-2">
            {selectedPatient ? <input type="hidden" name="id" value={selectedPatient.id} /> : null}
            <label className="text-sm font-medium text-slate-700">
              Nombre
              <input name="first_name" defaultValue={selectedPatient?.first_name ?? ""} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 focus:border-[#0f5c4d] focus:outline-none" required />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Apellido
              <input name="last_name" defaultValue={selectedPatient?.last_name ?? ""} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 focus:border-[#0f5c4d] focus:outline-none" required />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Fecha de nacimiento
              <input name="birth_date" type="date" defaultValue={selectedPatient?.birth_date ?? ""} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 focus:border-[#0f5c4d] focus:outline-none" required />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Sexo
              <select name="sex" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 focus:border-[#0f5c4d] focus:outline-none" defaultValue={selectedPatient?.sex ?? "female"}>
                <option value="female">female</option>
                <option value="male">male</option>
                <option value="other">other</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Actividad fisica
              <select name="activity_level" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 focus:border-[#0f5c4d] focus:outline-none" defaultValue={selectedPatient?.activity_level ?? "sedentary"}>
                <option value="sedentary">sedentary</option>
                <option value="light">light</option>
                <option value="moderate">moderate</option>
                <option value="high">high</option>
                <option value="very_high">very_high</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Documento
              <input name="document_number" defaultValue={selectedPatient?.document_number ?? ""} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 focus:border-[#0f5c4d] focus:outline-none" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Telefono
              <input name="phone" defaultValue={selectedPatient?.phone ?? ""} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 focus:border-[#0f5c4d] focus:outline-none" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Email
              <input name="email" type="email" defaultValue={selectedPatient?.email ?? ""} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 focus:border-[#0f5c4d] focus:outline-none" />
            </label>
            <label className="md:col-span-2 text-sm font-medium text-slate-700">
              Ocupacion
              <input name="occupation" defaultValue={selectedPatient?.occupation ?? ""} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 focus:border-[#0f5c4d] focus:outline-none" />
            </label>
            <label className="md:col-span-2 text-sm font-medium text-slate-700">
              Alergias
              <textarea name="allergies" rows={3} defaultValue={selectedPatient?.allergies ?? ""} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 focus:border-[#0f5c4d] focus:outline-none" />
            </label>
            <label className="md:col-span-2 text-sm font-medium text-slate-700">
              Intolerancias
              <textarea name="intolerances" rows={3} defaultValue={selectedPatient?.intolerances ?? ""} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 focus:border-[#0f5c4d] focus:outline-none" />
            </label>
            <label className="md:col-span-2 text-sm font-medium text-slate-700">
              Notas medicas
              <textarea name="medical_notes" rows={4} defaultValue={selectedPatient?.medical_notes ?? ""} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 focus:border-[#0f5c4d] focus:outline-none" />
            </label>
            <label className="md:col-span-2 text-sm font-medium text-slate-700">
              Notas de estilo de vida
              <textarea name="lifestyle_notes" rows={4} defaultValue={selectedPatient?.lifestyle_notes ?? ""} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 focus:border-[#0f5c4d] focus:outline-none" />
            </label>
            <button type="submit" className="md:col-span-2 rounded-full bg-[#0f5c4d] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0a4a3d]">
              {selectedPatient ? "Guardar cambios" : "Guardar paciente"}
            </button>
          </form>

          {selectedPatient ? (
            <form action={deletePatientAction} className="mt-4 border-t border-slate-200 pt-4">
              <input type="hidden" name="id" value={selectedPatient.id} />
              <button type="submit" className="rounded-full border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100">
                Eliminar paciente
              </button>
            </form>
          ) : null}
        </FormModalShell>
      ) : null}
    </main>
  );
}