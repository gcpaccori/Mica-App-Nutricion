import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AppHeaderClient } from "@/components/app-header-client";

type RoleRelation = { code?: string | null; name?: string | null } | Array<{ code?: string | null; name?: string | null }> | null;

export async function AppHeader() {
  let userEmail: string | null = null;
  let fullName: string | null = null;
  let roles: string[] = [];

  if (hasSupabaseEnv()) {
    const supabase = await createServerSupabaseClient();

    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        userEmail = user.email ?? null;

        const [{ data: profile }, { data: roleRows }] = await Promise.all([
          supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
          supabase.from("user_roles").select("roles(code, name)").eq("user_id", user.id),
        ]);

        fullName = profile?.full_name ?? null;
        roles =
          roleRows
            ?.flatMap((row) => {
              const relation = row.roles as RoleRelation;

              if (Array.isArray(relation)) {
                return relation.map((item) => item?.code).filter(Boolean);
              }

              return relation?.code ? [relation.code] : [];
            })
            .filter(Boolean) as string[] ?? [];
      }
    }
  }

  const isAuthenticated = Boolean(userEmail);

  return (
    <AppHeaderClient
      userEmail={userEmail}
      fullName={fullName}
      roles={roles}
      isAuthenticated={isAuthenticated}
    />
  );
}