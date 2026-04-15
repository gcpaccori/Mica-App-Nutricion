import { isAuthBypassEnabled } from "@/lib/env";
import type { SupabaseClient, User } from "@supabase/supabase-js";

function buildVirtualBypassUser() {
  const date = new Date(0).toISOString();

  return {
    id: "local-admin-bypass",
    aud: "authenticated",
    role: "authenticated",
    email: "admin@local",
    email_confirmed_at: date,
    phone: "",
    confirmed_at: date,
    last_sign_in_at: date,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: "Admin" },
    identities: [],
    created_at: date,
    updated_at: date,
    is_anonymous: false,
  };
}

export function attachAuthBypassVirtualUser<T extends SupabaseClient>(supabase: T): T {
  if (!isAuthBypassEnabled()) {
    return supabase;
  }

  const originalGetUser = supabase.auth.getUser.bind(supabase.auth);

  supabase.auth.getUser = (async (...args: Parameters<typeof originalGetUser>) => {
    const result = await originalGetUser(...args);

    if (result.data.user) {
      return result;
    }

    return {
      ...result,
      data: {
        ...result.data,
        user: buildVirtualBypassUser() as User,
      },
    };
  }) as typeof supabase.auth.getUser;

  return supabase;
}
