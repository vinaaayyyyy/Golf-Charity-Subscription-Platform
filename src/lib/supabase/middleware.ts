import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export async function updateSupabaseSession(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });

  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return { response, user: null as null | { id: string } };
  }

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(values) {
        for (const value of values) {
          response.cookies.set(value.name, value.value, value.options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
