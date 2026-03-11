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
  const foodId = Number(searchParams.get("foodId") ?? "0");

  if (!foodId || foodId <= 0) {
    return NextResponse.json({ error: "foodId invalido." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("nutrition_food_portion")
    .select("id, alimento_id, portion_label, net_grams, source")
    .eq("alimento_id", foodId)
    .order("net_grams")
    .order("portion_label");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ portions: data ?? [] });
}