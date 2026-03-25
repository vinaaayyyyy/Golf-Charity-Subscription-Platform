import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { buttonStyles } from "@/components/ui/button";
import { getCurrentViewer } from "@/lib/session";
import { cn } from "@/lib/utils";

const links = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/charities", label: "Charities" },
  { href: "/pricing", label: "Pricing" },
];

export async function SiteHeader() {
  const viewer = await getCurrentViewer();

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-background/85 backdrop-blur-xl">
      <div className="section-shell flex items-center justify-between gap-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="group flex items-center gap-3">
            <div className="soft-ring glow-pulse flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-sm font-bold text-white">
              GD
            </div>
            <div className="hidden sm:block">
              <p className="display-font text-xl font-semibold">Good Drive Club</p>
              <p className="text-xs tracking-[0.24em] uppercase text-muted">
                Play forward. Give bigger.
              </p>
            </div>
          </Link>
          <nav className="hidden items-center gap-5 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {viewer ? (
            <>
              <Link
                href={viewer.profile.role === "admin" ? "/admin" : "/dashboard"}
                className={cn(buttonStyles({ variant: "secondary", size: "sm" }))}
              >
                {viewer.profile.role === "admin" ? "Admin Panel" : "Dashboard"}
              </Link>
              <form action={logoutAction}>
                <button className={cn(buttonStyles({ variant: "primary", size: "sm" }))}>
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="hidden text-sm font-medium text-muted hover:text-foreground sm:block">
                Sign in
              </Link>
              <Link href="/admin/login" className="hidden text-sm font-medium text-muted hover:text-foreground lg:block">
                Admin
              </Link>
              <Link href="/pricing" className={cn(buttonStyles({ variant: "primary", size: "sm" }))}>
                Subscribe
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
