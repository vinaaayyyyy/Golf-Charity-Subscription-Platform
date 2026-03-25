import Link from "next/link";
import { getDemoCredentials } from "@/lib/platform";

export function SiteFooter() {
  const credentials = getDemoCredentials();

  return (
    <footer className="border-t border-line/60 bg-white/60">
      <div className="section-shell grid gap-10 py-10 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div className="space-y-4">
          <h3 className="display-font text-2xl font-semibold">A golf subscription platform that puts impact first.</h3>
          <p className="max-w-xl text-sm leading-6 text-muted">
            Good Drive Club blends recurring charitable giving, score-powered monthly draws, and a premium member experience built for modern sports communities.
          </p>
        </div>
        <div className="space-y-3 text-sm text-muted">
          <p className="font-semibold uppercase tracking-[0.22em] text-foreground">Routes</p>
          <Link href="/pricing" className="block hover:text-foreground">
            Subscription plans
          </Link>
          <Link href="/charities" className="block hover:text-foreground">
            Charity directory
          </Link>
          <Link href="/how-it-works" className="block hover:text-foreground">
            Draw mechanics
          </Link>
          <Link href="/admin/login" className="block hover:text-foreground">
            Admin login
          </Link>
        </div>
        <div className="space-y-3 text-sm text-muted">
          <p className="font-semibold uppercase tracking-[0.22em] text-foreground">Demo Access</p>
          <p>User: {credentials.user.email} / {credentials.user.password}</p>
          <p>Admin: {credentials.admin.email} / {credentials.admin.password}</p>
        </div>
      </div>
    </footer>
  );
}
