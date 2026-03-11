import { NextResponse } from "next/server";

import { getPatientWorkbookSnapshot, buildPatientWorkbook } from "@/lib/patient-sheet/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteProps = {
  params: Promise<{ id: string }>;
};

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function GET(_request: Request, { params }: RouteProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await getPatientWorkbookSnapshot(supabase, id);

  if (!snapshot) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const buffer = await buildPatientWorkbook(snapshot);
  const fileBase = sanitizeFileName(`${snapshot.patient.first_name}-${snapshot.patient.last_name}-ficha-clinica`) || "ficha-clinica";

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileBase}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}