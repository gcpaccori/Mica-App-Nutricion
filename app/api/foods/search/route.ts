import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase no configurado." }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const parsedLimit = Number(searchParams.get("limit") ?? "12");
  const limit = Math.min(30, Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 12));

  let foodsQuery = supabase
    .from("alimentos_26_grupos")
    .select("*")
    .order("grupo_numero")
    .order("alimento")
    .range(0, limit - 1);

  if (query) {
    foodsQuery = foodsQuery.ilike("alimento", `%${query}%`);
  }

  const { data, error } = await foodsQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ foods: data ?? [] });
}