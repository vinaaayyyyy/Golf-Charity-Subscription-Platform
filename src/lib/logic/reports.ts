import type {
  CharityLedgerEntry,
  DashboardKpis,
  DonationLedgerEntry,
  MonthlyDraw,
  PayoutLedgerEntry,
  SubscriptionRecord,
  WinnerClaim,
} from "@/lib/types";

export function buildDashboardKpis(args: {
  subscriptions: SubscriptionRecord[];
  draws: MonthlyDraw[];
  charityLedger: CharityLedgerEntry[];
  donations: DonationLedgerEntry[];
  payouts: PayoutLedgerEntry[];
  claims?: WinnerClaim[];
}): DashboardKpis {
  const activeSubscribers = args.subscriptions.filter((subscription) => subscription.status === "active").length;
  const totalPrizePoolCents = args.draws.reduce((sum, draw) => sum + draw.prizePoolCents, 0);
  const totalCharityCents = args.charityLedger.reduce((sum, entry) => sum + entry.amountCents, 0);
  const pendingClaims = args.claims
    ? args.claims.filter((claim) => claim.status === "pending" || claim.status === "approved").length
    : args.payouts.filter((payout) => payout.status === "pending").length;
  const rolloverCents = args.draws.at(-1)?.fiveMatchPoolCents ?? 0;

  return {
    activeSubscribers,
    totalPrizePoolCents,
    totalCharityCents,
    pendingClaims,
    rolloverCents,
  };
}
