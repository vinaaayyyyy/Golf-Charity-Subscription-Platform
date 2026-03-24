import Link from "next/link";
import { ArrowRight, BadgeIndianRupee, ChartColumnBig, HeartHandshake, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getHomeSnapshot } from "@/lib/platform";
import { formatCurrency, formatMonthLabel } from "@/lib/utils";

export default async function Home() {
  const snapshot = await getHomeSnapshot();

  return (
    <div className="pb-20">
      <section className="page-hero-grid overflow-hidden">
        <div className="section-shell grid gap-10 py-16 md:grid-cols-[1.15fr_0.85fr] md:py-24">
          <div className="reveal-up space-y-8">
            <Badge tone="warning">Subscription golf with tangible social impact</Badge>
            <div className="space-y-5">
              <h1 className="display-font max-w-4xl text-5xl font-semibold leading-[0.94] tracking-tight sm:text-6xl lg:text-7xl">
                Play your last five scores into a monthly prize draw that funds real causes.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted sm:text-xl">
                Good Drive Club is a premium charity-first subscription platform where every billing cycle powers golf prizes, community giving, and emotionally rich member experiences.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/pricing" className={buttonStyles({ variant: "primary", size: "lg" })}>
                Start a subscription
              </Link>
              <Link href="/charities" className={buttonStyles({ variant: "secondary", size: "lg" })}>
                Explore charities
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Raised to date", value: formatCurrency(snapshot.kpis.totalCharityCents) },
                { label: "Active subscribers", value: String(snapshot.kpis.activeSubscribers) },
                { label: "Latest rollover", value: formatCurrency(snapshot.kpis.rolloverCents) },
              ].map((stat) => (
                <div key={stat.label} className="rounded-[1.75rem] border border-line bg-white/75 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted">{stat.label}</p>
                  <p className="mt-3 text-2xl font-semibold">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <Card className="mesh-card float-slow relative overflow-hidden p-0">
            <div className="grid gap-0 sm:grid-cols-2">
              <div className="space-y-6 p-7">
                <Badge tone="success">{formatMonthLabel(snapshot.currentMonth)} draw window is live</Badge>
                <div className="space-y-3">
                  <p className="text-sm uppercase tracking-[0.24em] text-muted">Featured charity</p>
                  <h2 className="display-font text-3xl font-semibold">{snapshot.featuredCharity.name}</h2>
                  <p className="text-sm leading-7 text-muted">{snapshot.featuredCharity.description}</p>
                </div>
                <div className="rounded-[1.5rem] bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted">This month’s prize pool</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {formatCurrency(snapshot.kpis.totalPrizePoolCents)}
                  </p>
                </div>
              </div>
              <div className="bg-secondary px-7 py-8 text-white">
                <p className="text-sm uppercase tracking-[0.24em] text-white/70">Why it feels different</p>
                <div className="mt-6 space-y-5">
                  {[
                    { icon: HeartHandshake, text: "Lead with charity impact, not golf clichés." },
                    { icon: Trophy, text: "Turn your current form into real monthly prize odds." },
                    { icon: ShieldCheck, text: "Manual winner review keeps payouts transparent." },
                  ].map((item) => (
                    <div key={item.text} className="flex gap-3">
                      <item.icon className="mt-1 h-5 w-5 shrink-0 text-accent" />
                      <p className="text-sm leading-6 text-white/85">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="section-shell space-y-8 py-10 md:py-20">
        <SectionHeading
          eyebrow="How it works"
          title="One membership. Three engines moving underneath it."
          description="Subscription billing funds prize pools and charities, your latest five scores shape draw eligibility, and the admin team verifies winners through a deliberate review workflow."
        />
        <div className="grid gap-6 lg:grid-cols-3">
          {[
            {
              icon: BadgeIndianRupee,
              title: "Subscription engine",
              description:
                "Monthly and yearly billing routes through Stripe Checkout and the Customer Portal, with billing state synced through webhooks.",
            },
            {
              icon: ChartColumnBig,
              title: "Score-driven draw logic",
              description:
                "The platform stores your five most recent Stableford scores and matches them against a five-number monthly draw.",
            },
            {
              icon: Sparkles,
              title: "Charity-first membership",
              description:
                "Every member selects a cause, contributes at least 10%, and can make independent donations that never distort prize logic.",
            },
          ].map((item) => (
            <Card key={item.title} className="mesh-card space-y-4">
              <item.icon className="h-11 w-11 rounded-2xl bg-secondary-soft p-2 text-secondary" />
              <h3 className="display-font text-3xl font-semibold">{item.title}</h3>
              <p className="text-sm leading-7 text-muted">{item.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="section-shell py-10 md:py-20">
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card className="space-y-6">
            <SectionHeading
              eyebrow="Prize tiers"
              title="Transparent monthly splits"
              description="The pool is snapshotted per published month and split deterministically across all match tiers."
            />
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { tier: "5-match", split: "40%", note: "Rolls over when unwon" },
                { tier: "4-match", split: "35%", note: "Shared equally" },
                { tier: "3-match", split: "25%", note: "Shared equally" },
              ].map((item) => (
                <div key={item.tier} className="rounded-[1.5rem] border border-line bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted">{item.tier}</p>
                  <p className="mt-3 text-3xl font-semibold">{item.split}</p>
                  <p className="mt-2 text-sm text-muted">{item.note}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card className="mesh-card space-y-6">
            <SectionHeading
              eyebrow="Plans"
              title="Memberships that flex with giving"
              description="Pick your cadence, lock your cause, and scale your charity contribution without sacrificing a premium product feel."
            />
            <div className="space-y-4">
              {snapshot.plans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex flex-col gap-3 rounded-[1.5rem] border border-line bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="display-font text-2xl font-semibold">{plan.name}</p>
                    <p className="text-sm text-muted">
                      Starts at {formatCurrency(plan.previewPriceCents)} with a {plan.baseCharityPercent}% charity allocation.
                    </p>
                  </div>
                  <Link href="/pricing" className={buttonStyles({ variant: "secondary", size: "sm" })}>
                    Compare tiers
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className="section-shell py-10 md:py-20">
        <Card className="grid gap-8 p-8 lg:grid-cols-[0.9fr_1.1fr] lg:p-10">
          <div className="space-y-4">
            <Badge tone="warning">Featured spotlight</Badge>
            <h2 className="display-font text-4xl font-semibold">{snapshot.featuredCharity.name}</h2>
            <p className="text-base leading-7 text-muted">{snapshot.featuredCharity.mission}</p>
            <Link href={`/charities/${snapshot.featuredCharity.slug}`} className={buttonStyles({ variant: "dark", size: "md" })}>
              Meet the charity
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {snapshot.featuredCharity.upcomingEvents.map((event) => (
              <div key={event.id} className="rounded-[1.75rem] bg-secondary p-5 text-white">
                <p className="text-xs uppercase tracking-[0.24em] text-white/65">{event.location}</p>
                <p className="mt-3 text-2xl font-semibold">{event.title}</p>
                <p className="mt-2 text-sm text-white/85">{event.summary}</p>
              </div>
            ))}
            <div className="rounded-[1.75rem] bg-accent/25 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-muted">Raised so far</p>
              <p className="mt-3 text-4xl font-semibold">
                {formatCurrency(snapshot.featuredCharity.totalRaisedCents)}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                A transparent ledger tracks every subscription-linked charity allocation and every independent donation.
              </p>
            </div>
          </div>
        </Card>
      </section>

      <section className="section-shell py-10 md:py-20">
        <Card className="mesh-card flex flex-col items-start justify-between gap-6 p-8 lg:flex-row lg:items-center">
          <div className="space-y-3">
            <Badge>Ready for reviewer testing</Badge>
            <h2 className="display-font text-4xl font-semibold">Sign in as a member or admin and explore every surface.</h2>
            <p className="max-w-2xl text-base leading-7 text-muted">
              The app includes seeded users, historical draws, claims, donations, and dashboards so reviewers can test end-to-end flows immediately.
            </p>
          </div>
          <Link href="/sign-in" className={buttonStyles({ variant: "primary", size: "lg" })}>
            Open sign-in
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Card>
      </section>
    </div>
  );
}
