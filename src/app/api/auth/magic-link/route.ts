import { NextResponse } from "next/server";
import { env, isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email");

  if (typeof email !== "string" || email.trim().length === 0) {
    return NextResponse.redirect(new URL("/sign-in?error=missing-email", env.siteUrl));
  }

  if (isDemoMode()) {
    return NextResponse.redirect(new URL("/sign-in?info=magic-link-is-available-after-live-supabase-setup", env.siteUrl));
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/sign-in?error=server-error", env.siteUrl));
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: `${env.siteUrl}/api/auth/callback`,
    },
  });

  if (error) {
    return NextResponse.redirect(new URL("/sign-in?error=magic-link-send-failed", env.siteUrl));
  }

  return NextResponse.redirect(new URL("/sign-in?info=magic-link-sent-check-your-email", env.siteUrl));
}
