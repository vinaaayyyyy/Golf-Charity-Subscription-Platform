import Link from "next/link";
import { loginAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import { isDemoMode } from "@/lib/env";
import { getDemoCredentials } from "@/lib/platform";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const credentials = getDemoCredentials();
  const demoMode = isDemoMode();

  return (
    <div className="section-shell space-y-10 py-14 md:py-20">
      <SectionHeading
        eyebrow="Admin access"
        title="Dedicated login for operators, reviewers, and management accounts."
        description="Admin authentication is now separated from the public member login so platform operations stay clearly scoped."
      />
      {params.error ? (
        <Card className="border border-danger/30 bg-danger/8 text-sm text-danger">
          {params.error.replaceAll("-", " ")}.
        </Card>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="mesh-card space-y-5">
          <Badge tone="warning">Admin route</Badge>
          <p className="text-sm leading-7 text-muted">
            Use this page for admin-only accounts. Normal subscribers should continue through the standard sign-in flow.
          </p>
          {demoMode ? (
            <div className="rounded-[1.5rem] bg-white/80 p-4 text-sm text-muted">
              <p className="font-semibold text-foreground">Demo admin</p>
              <p>{credentials.admin.email}</p>
              <p>{credentials.admin.password}</p>
            </div>
          ) : (
            <p className="rounded-[1.5rem] bg-white/80 p-4 text-sm leading-7 text-muted">
              In live mode, admin accounts are provisioned from the admin dashboard and authenticated through Supabase.
            </p>
          )}
          <Link href="/sign-in" className="inline-flex text-sm font-semibold text-secondary hover:text-primary">
            Back to member login
          </Link>
        </Card>

        <Card className="space-y-5">
          <h2 className="display-font text-3xl font-semibold">Admin sign in</h2>
          <form action={loginAction} className="space-y-4">
            <input type="hidden" name="requestedRole" value="admin" />
            <label className="grid gap-2 text-sm font-medium">
              Email
              <input
                name="email"
                type="email"
                required
                defaultValue={demoMode ? credentials.admin.email : ""}
                className="h-12 rounded-2xl border border-line bg-white px-4 outline-none"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Password
              <input
                name="password"
                type="password"
                required
                defaultValue={demoMode ? credentials.admin.password : ""}
                className="h-12 rounded-2xl border border-line bg-white px-4 outline-none"
              />
            </label>
            <button className="h-12 w-full rounded-full bg-foreground font-medium text-background">
              Enter admin dashboard
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
