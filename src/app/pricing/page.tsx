import Link from "next/link";
import { SectionHeading } from "@/components/section-heading";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAvailableCharities, getAvailablePlanCards } from "@/lib/platform";
import { getCurrentViewer } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";

export default async function PricingPage() {
  const viewer = await getCurrentViewer();
  const plans = getAvailablePlanCards();
  const charities = await getAvailableCharities();

  return (
    <div className="section-shell space-y-10 py-14 md:py-20">
      <SectionHeading
        eyebrow="Pricing"
        title="Pick your cadence, your cause, and how much of your membership you want to push toward change."
        description="All plans include score tracking, draw participation, charity selection, billing controls, and winner verification workflows."
      />

      {!viewer ? (
        <Card className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="display-font text-3xl font-semibold">Sign in before checkout</p>
            <p className="text-sm leading-7 text-muted">
              Demo users can subscribe instantly, and new users can create an account in under a minute.
            </p>
          </div>
          <Link href="/sign-in" className={buttonStyles({ variant: "primary", size: "md" })}>
            Continue to sign-in
          </Link>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {plans.map((plan) => (
          <Card key={plan.id} className="mesh-card space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <Badge tone={plan.cadence === "yearly" ? "warning" : "default"}>
                  {plan.yearlySavingsLabel ?? "Flexible monthly billing"}
                </Badge>
                <div>
                  <h2 className="display-font text-4xl font-semibold">{plan.name}</h2>
                  <p className="text-sm text-muted">
                    Starts at {formatCurrency(plan.baseAmountCents)} before higher charity tiers.
                  </p>
                </div>
              </div>
              <div className="rounded-[1.5rem] bg-white/80 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Prize pool base</p>
                <p className="mt-1 text-xl font-semibold">{formatCurrency(plan.prizePoolBaseCents)}</p>
              </div>
            </div>

            <div className="grid gap-3">
              {plan.tiers.map((tier) => (
                <div key={`${plan.id}-${tier.tier}`} className="flex items-center justify-between rounded-[1.5rem] border border-line bg-white/80 px-4 py-3">
                  <div>
                    <p className="font-semibold text-foreground">{tier.tier}% charity tier</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">Recurring checkout amount</p>
                  </div>
                  <p className="text-xl font-semibold">{formatCurrency(tier.priceCents)}</p>
                </div>
              ))}
            </div>

            {viewer ? (
              <form action="/api/stripe/checkout" method="post" className="grid gap-4 rounded-[1.5rem] bg-white/80 p-4">
                <input type="hidden" name="cadence" value={plan.cadence} />
                <label className="grid gap-2 text-sm font-medium">
                  Choose charity
                  <select
                    name="charityId"
                    defaultValue={viewer.profile.selectedCharityId}
                    className="h-12 rounded-2xl border border-line bg-white px-4 outline-none"
                  >
                    {charities.map((charity) => (
                      <option key={charity.id} value={charity.id}>
                        {charity.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Charity contribution tier
                  <select
                    name="charityTier"
                    defaultValue={String(viewer.profile.charityTier)}
                    className="h-12 rounded-2xl border border-line bg-white px-4 outline-none"
                  >
                    {plan.tiers.map((tier) => (
                      <option key={tier.tier} value={tier.tier}>
                        {tier.tier}% · {formatCurrency(tier.priceCents)}
                      </option>
                    ))}
                  </select>
                </label>
                <button className={buttonStyles({ variant: "primary", size: "md", fullWidth: true })}>
                  Start {plan.cadence} checkout
                </button>
              </form>
            ) : (
              <Link href="/sign-in" className={buttonStyles({ variant: "secondary", size: "md", fullWidth: true })}>
                Sign in to subscribe
              </Link>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
