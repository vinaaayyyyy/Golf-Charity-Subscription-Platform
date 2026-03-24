import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteScoreAction,
  demoSubscriptionAction,
  saveScoreAction,
  submitClaimAction,
  updatePreferencesAction,
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAvailableCharities, getDashboardSnapshot } from "@/lib/platform";
import { getCurrentViewer } from "@/lib/session";
import { formatCurrency, formatDate, formatMonthLabel } from "@/lib/utils";

export default async function DashboardPage() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    notFound();
  }

  const snapshot = await getDashboardSnapshot(viewer);
  const charities = await getAvailableCharities();

  return (
    <div className="section-shell space-y-8 py-14 md:py-20">
      <Card className="mesh-card grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <Badge tone={viewer.isActiveSubscriber ? "success" : "danger"}>
            {viewer.isActiveSubscriber ? "Active subscriber" : "Access restricted until billing is active"}
          </Badge>
          <div>
            <h1 className="display-font text-4xl font-semibold sm:text-5xl">
              Welcome back, {viewer.profile.fullName.split(" ")[0]}.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
              Track your latest five scores, monitor your draw participation, manage your charity allocation, and submit winner proof when you hit a payout tier.
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[1.75rem] bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Plan</p>
            <p className="mt-2 text-2xl font-semibold">{snapshot.plan?.name ?? "Not subscribed"}</p>
            <p className="mt-1 text-sm text-muted">
              {snapshot.plan ? formatCurrency(snapshot.subscriptionPrice) : "Choose a plan to unlock all features"}
            </p>
          </div>
          <div className="rounded-[1.75rem] bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Upcoming draw</p>
            <p className="mt-2 text-2xl font-semibold">{formatMonthLabel(snapshot.upcomingMonth)}</p>
            <p className="mt-1 text-sm text-muted">
              {viewer.isActiveSubscriber ? "You are eligible if your five-score set stays current." : "Reactivate your plan to enter the next draw."}
            </p>
          </div>
        </div>
      </Card>

      {!viewer.isActiveSubscriber ? (
        <Card className="space-y-4">
          <h2 className="display-font text-3xl font-semibold">Reactivate subscription access</h2>
          <p className="text-sm leading-7 text-muted">
            Your account still has dashboard visibility, but score entry, draw participation, and claim submission stay locked until billing is active again.
          </p>
          <form action={demoSubscriptionAction} className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <label className="grid gap-2 text-sm font-medium">
              Plan cadence
              <select name="cadence" className="h-12 rounded-2xl border border-line bg-white px-4 outline-none">
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Charity tier
              <select name="charityTier" defaultValue={String(viewer.profile.charityTier)} className="h-12 rounded-2xl border border-line bg-white px-4 outline-none">
                {[10, 15, 20, 25, 30].map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}%
                  </option>
                ))}
              </select>
            </label>
            <button className="mt-auto h-12 rounded-full bg-primary px-6 font-medium text-white">
              Reactivate
            </button>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="display-font text-3xl font-semibold">Latest five scores</h2>
              <p className="mt-2 text-sm leading-7 text-muted">
                These five values are the only numbers that matter for the monthly draw engine.
              </p>
            </div>
            <Badge tone="warning">{snapshot.scores.length}/5 stored</Badge>
          </div>
          <form action={saveScoreAction} className="grid gap-4 rounded-[1.5rem] bg-white/80 p-4 md:grid-cols-[1fr_1fr_auto]">
            <label className="grid gap-2 text-sm font-medium">
              Stableford score
              <input name="score" type="number" min="1" max="45" className="h-12 rounded-2xl border border-line bg-white px-4 outline-none" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Date played
              <input name="playedAt" type="date" className="h-12 rounded-2xl border border-line bg-white px-4 outline-none" />
            </label>
            <button
              disabled={!viewer.isActiveSubscriber}
              className="mt-auto h-12 rounded-full bg-foreground px-6 font-medium text-background disabled:opacity-40"
            >
              Save score
            </button>
          </form>
          <div className="space-y-3">
            {snapshot.scores.map((score) => (
              <div key={score.id} className="rounded-[1.5rem] border border-line bg-white/80 p-4">
                <form action={saveScoreAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
                  <input type="hidden" name="scoreId" value={score.id} />
                  <label className="grid gap-1 text-sm font-medium">
                    Score
                    <input
                      name="score"
                      type="number"
                      min="1"
                      max="45"
                      defaultValue={score.score}
                      className="h-11 rounded-2xl border border-line bg-white px-4 outline-none"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                    Played
                    <input
                      name="playedAt"
                      type="date"
                      defaultValue={score.playedAt}
                      className="h-11 rounded-2xl border border-line bg-white px-4 outline-none"
                    />
                  </label>
                  <button
                    disabled={!viewer.isActiveSubscriber}
                    className="mt-auto h-11 rounded-full border border-line-strong px-5 text-sm font-medium disabled:opacity-40"
                  >
                    Update
                  </button>
                </form>
                <form action={deleteScoreAction} className="mt-3">
                  <input type="hidden" name="scoreId" value={score.id} />
                  <button
                    disabled={!viewer.isActiveSubscriber}
                    className="text-sm font-medium text-danger disabled:opacity-40"
                  >
                    Remove entry
                  </button>
                </form>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-5">
            <h2 className="display-font text-3xl font-semibold">Membership settings</h2>
            <form action={updatePreferencesAction} className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium">
                Selected charity
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
                  {[10, 15, 20, 25, 30].map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}%
                    </option>
                  ))}
                </select>
              </label>
              <button className="h-12 rounded-full bg-primary font-medium text-white">
                Save preferences
              </button>
            </form>
            {snapshot.charity ? (
              <div className="rounded-[1.5rem] bg-secondary p-4 text-white">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">Current cause</p>
                <p className="mt-2 text-2xl font-semibold">{snapshot.charity.name}</p>
                <p className="mt-2 text-sm text-white/80">{snapshot.charity.impactTag}</p>
              </div>
            ) : null}
          </Card>

          <Card className="mesh-card space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="display-font text-3xl font-semibold">Winnings and claims</h2>
                <p className="mt-2 text-sm leading-7 text-muted">
                  Total won: {formatCurrency(snapshot.totalWonCents)}
                </p>
              </div>
              {viewer.subscription?.status ? (
                <Badge tone={viewer.subscription.status === "active" ? "success" : "danger"}>
                  {viewer.subscription.status}
                </Badge>
              ) : null}
            </div>
            <div className="space-y-4">
              {snapshot.results.length === 0 ? (
                <div className="rounded-[1.5rem] bg-white/75 p-4 text-sm text-muted">
                  Your winnings summary will appear here after a published draw matches at least three of your scores.
                </div>
              ) : (
                snapshot.results.map((entry) => (
                  <div key={entry.result.id} className="rounded-[1.5rem] bg-white/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted">
                          {entry.draw ? formatMonthLabel(entry.draw.monthKey) : "Draw result"}
                        </p>
                        <p className="mt-2 text-2xl font-semibold">
                          {entry.result.tier.replace("_", " ")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-muted">
                          {formatCurrency(entry.result.prizeCents)}
                        </p>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted">
                          {entry.claim?.status ?? "Awaiting claim"}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-muted">
                      Numbers matched: {entry.result.numbersMatched.join(", ")}
                    </p>
                    {!entry.claim ? (
                      <form action={submitClaimAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                        <input type="hidden" name="drawResultId" value={entry.result.id} />
                        <input
                          type="file"
                          name="proof"
                          className="h-11 rounded-2xl border border-line bg-white px-4 py-2 text-sm"
                        />
                        <button className="h-11 rounded-full bg-foreground px-5 text-sm font-medium text-background">
                          Upload proof
                        </button>
                      </form>
                    ) : (
                      <p className="mt-4 text-sm text-muted">
                        Proof submitted on {formatDate(entry.claim.createdAt)}. Status: {entry.claim.status}.
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="display-font text-3xl font-semibold">Independent donations</h2>
                <p className="mt-2 text-sm leading-7 text-muted">
                  One-off giving supports charity totals without affecting draw eligibility.
                </p>
              </div>
              <form action="/api/stripe/customer-portal" method="post">
                <button className={buttonStyles({ variant: "secondary", size: "sm" })}>
                  Billing portal
                </button>
              </form>
            </div>
            <form action="/api/stripe/donations/checkout" method="post" className="grid gap-4 rounded-[1.5rem] bg-white/80 p-4 md:grid-cols-[1fr_1fr_auto]">
              <input type="hidden" name="charityId" value={viewer.profile.selectedCharityId} />
              <label className="grid gap-2 text-sm font-medium">
                Amount (INR)
                <input name="amount" type="number" min="500" step="100" defaultValue="2500" className="h-12 rounded-2xl border border-line bg-white px-4 outline-none" />
              </label>
              <div className="flex items-end text-sm leading-7 text-muted">
                Your donation is recorded separately from the monthly prize pool.
              </div>
              <button className="mt-auto h-12 rounded-full bg-primary px-6 font-medium text-white">
                Donate now
              </button>
            </form>
            <div className="space-y-3">
              {snapshot.donationHistory.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-[1.5rem] border border-line bg-white/80 px-4 py-3 text-sm">
                  <span className="text-muted">{formatDate(entry.recordedAt)}</span>
                  <span className="font-semibold">{formatCurrency(entry.amountCents)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="flex justify-end">
        <Link href="/charities" className={buttonStyles({ variant: "secondary", size: "md" })}>
          Explore more charities
        </Link>
      </div>
    </div>
  );
}
