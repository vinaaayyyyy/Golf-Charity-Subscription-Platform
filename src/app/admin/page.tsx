import {
  adminCreateAccountAction,
  adminDeleteUserAction,
  adminResyncSubscriptionAction,
  publishDrawAction,
  reviewClaimAction,
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAdminSnapshot, simulateMonthlyDraw } from "@/lib/platform";
import { requireAdmin } from "@/lib/session";
import { formatCurrency, formatDate, formatMonthLabel, toMonthKey } from "@/lib/utils";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: "random" | "algorithmic";
    bias?: "most_frequent" | "least_frequent";
    preview?: string;
    status?: string;
    error?: string;
  }>;
}) {
  const viewer = await requireAdmin();
  const params = await searchParams;
  const snapshot = await getAdminSnapshot();
  const preview =
    params.preview === "1"
      ? simulateMonthlyDraw({
          monthKey: toMonthKey(),
          mode: params.mode ?? "algorithmic",
          bias: params.bias ?? "most_frequent",
        })
      : null;

  return (
    <div className="section-shell space-y-8 py-14 md:py-20">
      {params.status ? (
        <Card className="border border-success/20 bg-success/8 py-4 text-sm text-success">
          Admin action completed: {params.status.replaceAll("-", " ")}.
        </Card>
      ) : null}
      {params.error ? (
        <Card className="border border-danger/20 bg-danger/8 py-4 text-sm text-danger">
          Admin action failed: {params.error.replaceAll("-", " ")}.
        </Card>
      ) : null}
      <Card className="mesh-card space-y-4">
        <Badge tone="warning">Administrator control center</Badge>
        <h1 className="display-font text-4xl font-semibold sm:text-5xl">
          Review operations, publish draws, and manage the integrity of every payout.
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-muted">
          Welcome back, {viewer.profile.fullName}. This admin surface exposes subscriber health, draw simulation, claims review, prize reporting, and charity oversight from one mobile-friendly console.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Active subscribers", value: String(snapshot.kpis.activeSubscribers) },
          { label: "Prize pools tracked", value: formatCurrency(snapshot.kpis.totalPrizePoolCents) },
          { label: "Charity routed", value: formatCurrency(snapshot.kpis.totalCharityCents) },
          { label: "Pending payouts", value: String(snapshot.kpis.pendingClaims) },
          { label: "Current rollover", value: formatCurrency(snapshot.kpis.rolloverCents) },
        ].map((item) => (
          <Card key={item.label} className="space-y-2 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">{item.label}</p>
            <p className="text-3xl font-semibold">{item.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="space-y-5">
          <h2 className="display-font text-3xl font-semibold">Draw controls</h2>
          <form method="get" className="grid gap-4 rounded-[1.5rem] bg-white/80 p-4 md:grid-cols-[1fr_1fr_auto]">
            <label className="grid gap-2 text-sm font-medium">
              Mode
              <select name="mode" defaultValue={params.mode ?? "algorithmic"} className="h-12 rounded-2xl border border-line bg-white px-4 outline-none">
                <option value="random">Random</option>
                <option value="algorithmic">Algorithmic</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Bias
              <select name="bias" defaultValue={params.bias ?? "most_frequent"} className="h-12 rounded-2xl border border-line bg-white px-4 outline-none">
                <option value="most_frequent">Most frequent</option>
                <option value="least_frequent">Least frequent</option>
              </select>
            </label>
            <button name="preview" value="1" className="mt-auto h-12 rounded-full bg-foreground px-6 font-medium text-background">
              Run simulation
            </button>
          </form>
          <form action={publishDrawAction} className="grid gap-4 rounded-[1.5rem] border border-line bg-white/80 p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
            <input type="hidden" name="monthKey" value={toMonthKey()} />
            <label className="grid gap-2 text-sm font-medium">
              Month
              <input value={formatMonthLabel(toMonthKey())} readOnly className="h-12 rounded-2xl border border-line bg-white px-4 outline-none" />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Mode
              <select name="mode" defaultValue={params.mode ?? "algorithmic"} className="h-12 rounded-2xl border border-line bg-white px-4 outline-none">
                <option value="random">Random</option>
                <option value="algorithmic">Algorithmic</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Bias
              <select name="bias" defaultValue={params.bias ?? "most_frequent"} className="h-12 rounded-2xl border border-line bg-white px-4 outline-none">
                <option value="most_frequent">Most frequent</option>
                <option value="least_frequent">Least frequent</option>
              </select>
            </label>
            <button className="mt-auto h-12 rounded-full bg-primary px-6 font-medium text-white">
              Publish draw
            </button>
          </form>

          {preview ? (
            <div className="space-y-4 rounded-[1.5rem] bg-secondary p-5 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/60">Simulation preview</p>
                  <p className="mt-2 text-3xl font-semibold">{preview.draw.numbers.join(" · ")}</p>
                </div>
                <Badge tone="warning">{preview.provisionalResults.length} provisional winners</Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/60">Prize pool</p>
                  <p className="mt-2 text-xl font-semibold">{formatCurrency(preview.draw.prizePoolCents)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/60">Charity total</p>
                  <p className="mt-2 text-xl font-semibold">{formatCurrency(preview.draw.charityTotalCents)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/60">Next rollover</p>
                  <p className="mt-2 text-xl font-semibold">{formatCurrency(preview.nextRolloverCents)}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-white/85">
                {preview.provisionalResults.length === 0 ? (
                  <p>No winning tiers generated in this preview.</p>
                ) : (
                  preview.provisionalResults.map((result) => (
                    <p key={result.id}>
                      {result.userId} · {result.tier} · {formatCurrency(result.prizeCents)} · matched {result.numbersMatched.join(", ")}
                    </p>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="display-font text-3xl font-semibold">Winner verification</h2>
              <p className="mt-2 text-sm leading-7 text-muted">
                Claims move through pending, approved, rejected, and paid with explicit notes and timestamps.
              </p>
            </div>
            {snapshot.latestDraw ? (
              <Badge tone="success">{formatMonthLabel(snapshot.latestDraw.monthKey)} published</Badge>
            ) : null}
          </div>
          <div className="space-y-4">
            {snapshot.claims.map((item) => (
              <div key={item.claim.id} className="rounded-[1.5rem] border border-line bg-white/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-muted">{item.user?.email}</p>
                    <p className="mt-2 text-xl font-semibold">{item.result?.tier.replace("_", " ")}</p>
                  </div>
                  <Badge tone={item.claim.status === "paid" ? "success" : item.claim.status === "rejected" ? "danger" : "warning"}>
                    {item.claim.status}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-7 text-muted">
                  Proof: {item.claim.proofUrl} • Submitted {formatDate(item.claim.createdAt)}
                </p>
                <form action={reviewClaimAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <input type="hidden" name="claimId" value={item.claim.id} />
                  <label className="grid gap-2 text-sm font-medium">
                    Status
                    <select name="status" defaultValue={item.claim.status} className="h-11 rounded-2xl border border-line bg-white px-4 outline-none">
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="paid">Paid</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Note
                    <input name="note" defaultValue={item.claim.notes ?? ""} className="h-11 rounded-2xl border border-line bg-white px-4 outline-none" />
                  </label>
                  <button className="mt-auto h-11 rounded-full bg-foreground px-5 text-sm font-medium text-background">
                    Save review
                  </button>
                </form>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="display-font text-3xl font-semibold">Users and subscriptions</h2>
            <a
              href="/api/admin/reports/export"
              className="rounded-full border border-line-strong px-4 py-2 text-sm font-medium hover:border-secondary"
            >
              Export CSV
            </a>
          </div>
          <div className="space-y-3">
            {snapshot.users.map((user) => (
              <div key={user.profile.id} className="rounded-[1.5rem] border border-line bg-white/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-muted">{user.profile.email}</p>
                    <p className="mt-2 text-xl font-semibold">{user.profile.fullName}</p>
                  </div>
                  <Badge tone={user.subscription?.status === "active" ? "success" : "danger"}>
                    {user.subscription?.status ?? "inactive"}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-muted">
                  Latest scores: {user.scores.map((score) => score.score).join(", ") || "No scores yet"}
                </p>
                {user.subscription ? (
                  <form action={adminResyncSubscriptionAction} className="mt-4">
                    <input type="hidden" name="subscriptionId" value={user.subscription.id} />
                    <button className="text-sm font-medium text-secondary">
                      Resync subscription snapshot
                    </button>
                  </form>
                ) : null}
                <form action={adminDeleteUserAction} className="mt-2">
                  <input type="hidden" name="profileId" value={user.profile.id} />
                  <button className="text-sm font-medium text-danger">
                    Remove user
                  </button>
                </form>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-5">
          <h2 className="display-font text-3xl font-semibold">Team management</h2>
          <form action={adminCreateAccountAction} className="grid gap-4 rounded-[1.5rem] bg-white/80 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                Full name
                <input name="fullName" className="h-12 rounded-2xl border border-line bg-white px-4 outline-none" required />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Email
                <input name="email" type="email" className="h-12 rounded-2xl border border-line bg-white px-4 outline-none" required />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <label className="grid gap-2 text-sm font-medium">
                Password
                <input name="password" type="password" className="h-12 rounded-2xl border border-line bg-white px-4 outline-none" required />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Role
                <select name="role" defaultValue="admin" className="h-12 rounded-2xl border border-line bg-white px-4 outline-none">
                  <option value="admin">Admin</option>
                  <option value="subscriber">Subscriber</option>
                </select>
              </label>
              <button className="mt-auto h-12 rounded-full bg-primary px-6 font-medium text-white">
                Create account
              </button>
            </div>
          </form>
          <div className="space-y-3">
            {snapshot.admins.map((item) => (
              <div key={item.profile.id} className="rounded-[1.5rem] border border-line bg-white/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-muted">{item.profile.email}</p>
                    <p className="mt-2 text-xl font-semibold">{item.profile.fullName}</p>
                  </div>
                  <Badge tone="success">admin</Badge>
                </div>
                <p className="mt-3 text-sm text-muted">
                  {("account" in item && item.account?.password)
                    ? `Demo password: ${item.account.password}`
                    : "Provisioned through Supabase Auth."}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="space-y-5">
          <h2 className="display-font text-3xl font-semibold">Charities</h2>
          <div className="space-y-3">
            {snapshot.charities.map((charity) => (
              <div key={charity.id} className="rounded-[1.5rem] border border-line bg-white/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-muted">{charity.category}</p>
                    <p className="mt-2 text-xl font-semibold">{charity.name}</p>
                  </div>
                  <Badge tone={charity.active ? "success" : "danger"}>{charity.active ? "active" : "archived"}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted">Raised: {formatCurrency(charity.totalRaisedCents)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-5">
          <h2 className="display-font text-3xl font-semibold">Recent audit trail</h2>
          <div className="rounded-[1.5rem] bg-secondary p-5 text-white">
            <p className="text-xs uppercase tracking-[0.22em] text-white/60">Recent admin actions</p>
            <div className="mt-4 space-y-3 text-sm text-white/85">
              {snapshot.audits.map((audit) => (
                <p key={audit.id}>
                  {formatDate(audit.createdAt)} · {audit.summary}
                </p>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
