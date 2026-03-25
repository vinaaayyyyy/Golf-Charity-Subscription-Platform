import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

const sessionCookie = "good-drive-demo-session";
const roleCookie = "good-drive-demo-role";

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSupabaseSession(request);
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/dashboard") && !pathname.startsWith("/admin")) {
    return response;
  }

  const hasSession = Boolean(request.cookies.get(sessionCookie)?.value);
  const role = request.cookies.get(roleCookie)?.value;
  const isAuthenticated = hasSession || Boolean(user);

  if (!isAuthenticated) {
    const loginUrl = new URL(pathname.startsWith("/admin") ? "/admin/login" : "/sign-in", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && hasSession && role !== "admin") {
    const dashboardUrl = new URL("/dashboard?error=admin-only", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
