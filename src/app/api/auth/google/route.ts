import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (isDemoMode()) {
    return NextResponse.redirect(new URL("/sign-in?info=google-auth-is-available-after-live-supabase-setup", env.siteUrl));
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/sign-in?error=server-error", env.siteUrl));
  }

  const origin = new URL(request.url).origin;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/api/auth/callback`,
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/sign-in?error=oauth-failed", env.siteUrl));
  }

  return NextResponse.redirect(data.url);
}
