import Link from "next/link";
import { loginAction, signupAction } from "@/app/actions";
import { SectionHeading } from "@/components/section-heading";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { isDemoMode } from "@/lib/env";
import { getAvailableCharities, getDemoCredentials } from "@/lib/platform";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string }>;
}) {
  const params = await searchParams;
  const charities = await getAvailableCharities();
  const credentials = getDemoCredentials();
  const demoMode = isDemoMode();

  return (
    <div className="section-shell space-y-10 py-14 md:py-20">
      <SectionHeading
        eyebrow="Access"
        title="Reviewer-ready sign in with seeded user and admin journeys."
        description="Use the test credentials below or create a new demo subscriber account directly from this screen."
      />
      {params.error ? (
        <Card className="border border-danger/30 bg-danger/8 text-sm text-danger">
          Sign in failed. Try one of the demo credentials shown below.
        </Card>
      ) : null}
      {params.info ? (
        <Card className="border border-secondary/20 bg-secondary-soft/40 text-sm text-secondary">
          {params.info.replaceAll("-", " ")}.
        </Card>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="mesh-card space-y-5">
          <Badge tone="warning">{demoMode ? "Demo credentials" : "Member access"}</Badge>
          <div className="space-y-4 text-sm text-muted">
            <div className="rounded-[1.5rem] bg-white/80 p-4">
              <p className="font-semibold text-foreground">Subscriber</p>
              <p>{credentials.user.email}</p>
              <p>{credentials.user.password}</p>
            </div>
            <p className="leading-7">
              Subscriber login and signup live here. Admin access now uses a dedicated entry point so management accounts are kept separate from normal member onboarding.
            </p>
            <Link href="/admin/login" className="inline-flex text-sm font-semibold text-secondary hover:text-primary">
              Open admin login
            </Link>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-5">
            <div>
              <h2 className="display-font text-3xl font-semibold">Sign in</h2>
              <p className="mt-2 text-sm leading-7 text-muted">
                Access the subscriber dashboard or the admin control center.
              </p>
            </div>
            <form action={loginAction} className="space-y-4">
              <input type="hidden" name="requestedRole" value="subscriber" />
              <label className="grid gap-2 text-sm font-medium">
                Email
                <input
                  name="email"
                  required
                  defaultValue={credentials.user.email}
                  className="h-12 rounded-2xl border border-line bg-white px-4 outline-none"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Password
                <input
                  name="password"
                  type="password"
                  required
                  defaultValue={credentials.user.password}
                  className="h-12 rounded-2xl border border-line bg-white px-4 outline-none"
                />
              </label>
              <button className="h-12 w-full rounded-full bg-primary font-medium text-white">
                Sign in
              </button>
            </form>

            {!demoMode ? (
              <>
                <div className="relative my-1 flex items-center gap-3">
                  <div className="h-px flex-1 bg-line" />
                  <span className="text-xs text-muted">or</span>
                  <div className="h-px flex-1 bg-line" />
                </div>

                <a
                  href="/api/auth/google"
                  className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-line bg-white font-medium text-foreground hover:bg-gray-50"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </a>

                <form action="/api/auth/magic-link" method="post" className="space-y-3 rounded-[1.5rem] bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Passwordless recovery</p>
                  <div className="flex gap-2">
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="Enter your email"
                      className="h-11 flex-1 rounded-full border border-line bg-white px-4 outline-none"
                    />
                    <button className="h-11 rounded-full bg-foreground px-4 text-sm font-medium text-background">
                      Send magic link
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <p className="rounded-[1.5rem] bg-white/70 p-4 text-sm leading-7 text-muted">
                Google OAuth and magic-link recovery appear automatically once Supabase auth is wired with real credentials.
              </p>
            )}
          </Card>

          <Card className="mesh-card space-y-5">
            <div>
              <h2 className="display-font text-3xl font-semibold">Create a demo subscriber</h2>
              <p className="mt-2 text-sm leading-7 text-muted">
                Sign up, pick a charity, and jump straight into a seeded production-style flow.
              </p>
            </div>
            <form action={signupAction} className="space-y-4">
              <label className="grid gap-2 text-sm font-medium">
                Full name
                <input name="fullName" required className="h-12 rounded-2xl border border-line bg-white px-4 outline-none" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Email
                <input name="email" type="email" required className="h-12 rounded-2xl border border-line bg-white px-4 outline-none" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Password
                <input name="password" type="password" required className="h-12 rounded-2xl border border-line bg-white px-4 outline-none" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  Charity
                  <select name="charityId" className="h-12 rounded-2xl border border-line bg-white px-4 outline-none">
                    {charities.map((charity) => (
                      <option key={charity.id} value={charity.id}>
                        {charity.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Charity tier
                  <select name="charityTier" defaultValue="10" className="h-12 rounded-2xl border border-line bg-white px-4 outline-none">
                    {[10, 15, 20, 25, 30].map((tier) => (
                      <option key={tier} value={tier}>
                        {tier}%
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button className="h-12 w-full rounded-full bg-foreground font-medium text-background">
                Create account
              </button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
