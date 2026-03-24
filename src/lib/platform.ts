import { seededCurrentMonth } from "@/lib/demo-data";
import { getDemoStore, mutateDemoStore } from "@/lib/demo-store";
import { isDemoMode } from "@/lib/env";
import { simulateDrawSummary } from "@/lib/logic/draws";
import { buildDashboardKpis } from "@/lib/logic/reports";
import { sortScoresDescending, upsertUserScore } from "@/lib/logic/scores";
import { sendTransactionalEmail } from "@/lib/resend";
import { formatCurrency, toMonthKey } from "@/lib/utils";
import type {
  Charity,
  CharityTier,
  ClaimStatus,
  DrawMode,
  FrequencyBias,
  MonthlyDrawSummary,
  PlanCadence,
  Profile,
  ScoreEntry,
  SubscriptionRecord,
  ViewerContext,
  WinnerClaim,
} from "@/lib/types";

function getPlanPrice(subscriptionBaseCents: number, tier: CharityTier) {
  const uplift = Math.max(0, tier - 10);
  return Math.round(subscriptionBaseCents * (1 + uplift / 100));
}

function getLatestPublishedDraw() {
  return [...getDemoStore().monthlyDraws]
    .filter((draw) => !draw.simulationOnly && draw.publishedAt)
    .sort((left, right) => left.monthKey.localeCompare(right.monthKey))
    .at(-1);
}

function getRollingFive(userId: string) {
  return sortScoresDescending(getDemoStore().scoreEntries.filter((entry) => entry.userId === userId)).slice(0, 5);
}

function getProfile(userId: string) {
  return getDemoStore().profiles.find((profile) => profile.id === userId);
}

function getCharity(charityId: string) {
  return getDemoStore().charities.find((charity) => charity.id === charityId);
}

function getSubscription(userId: string) {
  return getDemoStore().subscriptions.find((subscription) => subscription.userId === userId);
}

function getRolloverForMonth(monthKey: string) {
  const previousDraw = getLatestPublishedDraw();

  if (!previousDraw || previousDraw.monthKey === monthKey) {
    return 0;
  }

  const hasFiveMatchWinner = getDemoStore().drawResults.some(
    (result) => result.drawId === previousDraw.id && result.tier === "five_match",
  );

  return hasFiveMatchWinner ? 0 : previousDraw.fiveMatchPoolCents;
}

function getCharityTotalsForMonth(monthKey: string) {
  const store = getDemoStore();
  const charityLedger = store.charityLedger.filter((entry) => entry.recordedAt.startsWith(monthKey));
  const donations = store.donationLedger.filter((entry) => entry.recordedAt.startsWith(monthKey));
  return [...charityLedger, ...donations].reduce((sum, entry) => sum + entry.amountCents, 0);
}

export async function getHomeSnapshot() {
  if (!isDemoMode()) {
    const { getLiveHomeSnapshot } = await import("@/lib/live-platform");
    return getLiveHomeSnapshot();
  }
  const store = getDemoStore();
  const kpis = buildDashboardKpis({
    subscriptions: store.subscriptions,
    draws: store.monthlyDraws,
    charityLedger: store.charityLedger,
    donations: store.donationLedger,
    payouts: store.payoutLedger,
  });
  const featuredCharity = store.charities.find((charity) => charity.featured) ?? store.charities[0];
  const plans = store.plans.map((plan) => ({
    ...plan,
    previewPriceCents: getPlanPrice(plan.baseAmountCents, plan.baseCharityPercent),
  }));
  return { featuredCharity, charities: store.charities, plans, kpis, currentMonth: seededCurrentMonth };
}

export async function getCharityDirectorySnapshot() {
  if (!isDemoMode()) {
    const { getLiveCharityDirectory } = await import("@/lib/live-platform");
    return getLiveCharityDirectory();
  }
  const store = getDemoStore();
  return {
    charities: store.charities.filter((charity) => charity.active),
    categories: Array.from(new Set(store.charities.map((charity) => charity.category))),
  };
}

export async function getCharityPageSnapshot(slug: string) {
  if (!isDemoMode()) {
    const { getLiveCharityPage } = await import("@/lib/live-platform");
    return getLiveCharityPage(slug);
  }
  const charity = getDemoStore().charities.find((candidate) => candidate.slug === slug);
  if (!charity) return null;
  const related = getDemoStore().charities.filter(
    (candidate) => candidate.category === charity.category && candidate.id !== charity.id,
  );
  return { charity, related };
}

export function authenticateDemoUser(email: string, password: string) {
  const store = getDemoStore();
  const profile = store.profiles.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase());
  const account = store.demoAccounts.find((candidate) => candidate.userId === profile?.id);

  if (!profile || !account || account.password !== password) {
    return null;
  }

  return profile;
}

export function createDemoSubscriber(input: {
  fullName: string;
  email: string;
  password: string;
  selectedCharityId: string;
  charityTier: CharityTier;
}) {
  return mutateDemoStore((store) => {
    const existing = store.profiles.find((profile) => profile.email.toLowerCase() === input.email.toLowerCase());
    if (existing) {
      throw new Error("An account with that email already exists.");
    }

    const id = `user-${Math.random().toString(36).slice(2, 10)}`;
    const profile: Profile = {
      id,
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      role: "subscriber",
      selectedCharityId: input.selectedCharityId,
      charityTier: input.charityTier,
      countryCode: "IN",
      currencyCode: "INR",
      createdAt: new Date().toISOString(),
    };

    store.profiles.push(profile);
    store.demoAccounts.push({ userId: id, password: input.password });
    store.auditLogs.push({
      id: `audit-${Math.random().toString(36).slice(2, 10)}`,
      actorId: id,
      action: "auth.signup",
      targetType: "profile",
      targetId: id,
      createdAt: new Date().toISOString(),
      summary: "Created a demo subscriber account.",
    });

    return profile;
  });
}

export async function getDashboardSnapshot(viewer: ViewerContext) {
  if (!isDemoMode()) {
    const { getLiveDashboardSnapshot } = await import("@/lib/live-platform");
    return getLiveDashboardSnapshot(viewer);
  }
  const store = getDemoStore();
  const plan = viewer.subscription
    ? store.plans.find((candidate) => candidate.id === viewer.subscription?.planId)
    : undefined;
  const charity = getCharity(viewer.profile.selectedCharityId);
  const scores = getRollingFive(viewer.profile.id);
  const results = store.drawResults
    .filter((result) => result.userId === viewer.profile.id)
    .map((result) => {
      const draw = store.monthlyDraws.find((candidate) => candidate.id === result.drawId);
      const claim = store.winnerClaims.find((candidate) => candidate.drawResultId === result.id);
      return { result, draw, claim };
    });
  const subscriptionPrice = plan ? getPlanPrice(plan.baseAmountCents, viewer.profile.charityTier) : 0;
  const donationHistory = store.donationLedger
    .filter((entry) => entry.userId === viewer.profile.id)
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));
  const totalWonCents = results.reduce((sum, entry) => sum + entry.result.prizeCents, 0);
  const upcomingMonth = seededCurrentMonth;

  return {
    plan,
    charity,
    scores,
    results,
    donationHistory,
    totalWonCents,
    subscriptionPrice,
    upcomingMonth,
  };
}

export async function getAdminSnapshot() {
  if (!isDemoMode()) {
    const { getLiveAdminSnapshot } = await import("@/lib/live-platform");
    return getLiveAdminSnapshot();
  }
  const store = getDemoStore();
  const kpis = buildDashboardKpis({
    subscriptions: store.subscriptions,
    draws: store.monthlyDraws,
    charityLedger: store.charityLedger,
    donations: store.donationLedger,
    payouts: store.payoutLedger,
  });
  const claims = store.winnerClaims
    .map((claim) => ({
      claim,
      result: store.drawResults.find((result) => result.id === claim.drawResultId),
      user: store.profiles.find((profile) => profile.id === claim.userId),
    }))
    .sort((left, right) => right.claim.createdAt.localeCompare(left.claim.createdAt));
  const users = store.profiles
    .filter((profile) => profile.role === "subscriber")
    .map((profile) => ({
      profile,
      subscription: getSubscription(profile.id),
      scores: getRollingFive(profile.id),
    }));
  const latestDraw = getLatestPublishedDraw();

  return {
    kpis,
    users,
    claims,
    latestDraw,
    charities: store.charities,
    plans: store.plans,
    audits: [...store.auditLogs].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 8),
  };
}

export async function saveUserScore(userId: string, input: { score: number; playedAt: string; id?: string }) {
  if (!isDemoMode()) {
    const { saveLiveScore } = await import("@/lib/live-platform");
    return saveLiveScore(userId, input);
  }
  return mutateDemoStore((store) => {
    store.scoreEntries = upsertUserScore(store.scoreEntries, {
      userId,
      id: input.id,
      score: input.score,
      playedAt: input.playedAt,
    });

    store.auditLogs.push({
      id: `audit-${Math.random().toString(36).slice(2, 10)}`,
      actorId: userId,
      action: "scores.upsert",
      targetType: "score_entry",
      targetId: input.id ?? "new",
      createdAt: new Date().toISOString(),
      summary: "Updated latest score history.",
    });
  });
}

export async function deleteUserScore(userId: string, scoreId: string) {
  if (!isDemoMode()) {
    const { deleteLiveScore } = await import("@/lib/live-platform");
    return deleteLiveScore(userId, scoreId);
  }
  return mutateDemoStore((store) => {
    store.scoreEntries = store.scoreEntries.filter((entry) => !(entry.userId === userId && entry.id === scoreId));
  });
}

export async function updateUserPreferences(userId: string, input: { charityId: string; charityTier: CharityTier }) {
  if (!isDemoMode()) {
    const { updateLivePreferences } = await import("@/lib/live-platform");
    return updateLivePreferences(userId, input);
  }
  return mutateDemoStore((store) => {
    const profile = store.profiles.find((candidate) => candidate.id === userId);
    if (!profile) throw new Error("Profile not found.");
    profile.selectedCharityId = input.charityId;
    profile.charityTier = input.charityTier;
  });
}

export function activateDemoSubscription(userId: string, cadence: PlanCadence, tier: CharityTier) {
  return mutateDemoStore((store) => {
    const plan = store.plans.find((candidate) => candidate.cadence === cadence);
    const profile = store.profiles.find((candidate) => candidate.id === userId);

    if (!plan || !profile) {
      throw new Error("Unable to activate subscription.");
    }

    const currentPeriodStart = new Date().toISOString();
    const currentPeriodEnd =
      cadence === "monthly"
        ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
        : new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();

    const existing = store.subscriptions.find((candidate) => candidate.userId === userId);

    if (existing) {
      existing.status = "active";
      existing.planId = plan.id;
      existing.cadence = cadence;
      existing.currentPeriodStart = currentPeriodStart;
      existing.currentPeriodEnd = currentPeriodEnd;
      existing.latestInvoiceStatus = "paid";
      existing.stripePriceId = `price_demo_${cadence}_${tier}`;
      existing.updatedAt = new Date().toISOString();
    } else {
      store.subscriptions.push({
        id: `sub-${Math.random().toString(36).slice(2, 10)}`,
        userId,
        planId: plan.id,
        cadence,
        status: "active",
        stripeCustomerId: `cus_demo_${userId}`,
        stripeSubscriptionId: `sub_demo_${userId}`,
        stripePriceId: `price_demo_${cadence}_${tier}`,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
        latestInvoiceStatus: "paid",
        updatedAt: new Date().toISOString(),
      });
    }

    profile.charityTier = tier;
    store.charityLedger.push({
      id: `ledger-${Math.random().toString(36).slice(2, 10)}`,
      userId,
      charityId: profile.selectedCharityId,
      amountCents: Math.round(getPlanPrice(plan.baseAmountCents, tier) * (tier / 100)),
      source: "subscription",
      recordedAt: new Date().toISOString(),
    });
  });
}

export async function recordIndependentDonation(userId: string, charityId: string, amountCents: number) {
  mutateDemoStore((store) => {
    store.donationLedger.push({
      id: `donation-${Math.random().toString(36).slice(2, 10)}`,
      userId,
      charityId,
      amountCents,
      recordedAt: new Date().toISOString(),
    });

    store.charityLedger.push({
      id: `ledger-${Math.random().toString(36).slice(2, 10)}`,
      userId,
      charityId,
      amountCents,
      source: "donation",
      recordedAt: new Date().toISOString(),
    });
  });

  const profile = getProfile(userId);
  if (profile) {
    await sendTransactionalEmail({
      to: profile.email,
      subject: "Independent donation recorded",
      html: `<p>Thanks for giving an additional ${formatCurrency(amountCents)} to your chosen charity.</p>`,
    });
  }
}

export function simulateMonthlyDraw(input: {
  monthKey?: string;
  mode: DrawMode;
  bias?: FrequencyBias;
}): MonthlyDrawSummary {
  const store = getDemoStore();
  const monthKey = input.monthKey ?? seededCurrentMonth;
  return simulateDrawSummary({
    monthKey,
    mode: input.mode,
    bias: input.bias,
    subscriptions: store.subscriptions,
    plans: store.plans,
    profiles: store.profiles.filter((profile) => profile.role === "subscriber"),
    scores: store.scoreEntries,
    charityTotalCents: getCharityTotalsForMonth(monthKey),
    rolloverFromPreviousCents: getRolloverForMonth(monthKey),
  });
}

export function publishMonthlyDraw(input: {
  monthKey?: string;
  mode: DrawMode;
  bias?: FrequencyBias;
  actorId: string;
}) {
  return mutateDemoStore((store) => {
    const monthKey = input.monthKey ?? toMonthKey();
    const existing = store.monthlyDraws.find((draw) => draw.monthKey === monthKey && !draw.simulationOnly);

    if (existing) {
      throw new Error("That month has already been published.");
    }

    const summary = simulateMonthlyDraw({
      monthKey,
      mode: input.mode,
      bias: input.bias,
    });
    const drawId = `draw-${monthKey}`;
    const draw = {
      ...summary.draw,
      id: drawId,
      simulationOnly: false,
      publishedAt: new Date().toISOString(),
    };

    store.monthlyDraws = store.monthlyDraws.filter((candidate) => candidate.monthKey !== monthKey);
    store.monthlyDraws.push(draw);

    const publishedResults = summary.provisionalResults.map((result) => ({
      ...result,
      id: `result-${Math.random().toString(36).slice(2, 10)}`,
      drawId,
    }));

    store.drawResults = [
      ...store.drawResults.filter((candidate) => candidate.drawId !== drawId),
      ...publishedResults,
    ];

    store.auditLogs.push({
      id: `audit-${Math.random().toString(36).slice(2, 10)}`,
      actorId: input.actorId,
      action: "draw.publish",
      targetType: "monthly_draw",
      targetId: drawId,
      createdAt: new Date().toISOString(),
      summary: `Published ${monthKey} draw in ${input.mode} mode.`,
    });

    return { draw, results: publishedResults };
  });
}

export function submitWinnerClaim(userId: string, input: { drawResultId: string; proofName: string }) {
  return mutateDemoStore((store) => {
    const result = store.drawResults.find((candidate) => candidate.id === input.drawResultId && candidate.userId === userId);
    if (!result) {
      throw new Error("Winner result not found.");
    }

    const existing = store.winnerClaims.find((claim) => claim.drawResultId === input.drawResultId);
    if (existing) {
      existing.proofUrl = `demo://${input.proofName}`;
      existing.status = "pending";
      existing.reviewedAt = undefined;
      result.claimStatus = "pending";
      return existing;
    }

    const claim: WinnerClaim = {
      id: `claim-${Math.random().toString(36).slice(2, 10)}`,
      drawResultId: input.drawResultId,
      userId,
      proofUrl: `demo://${input.proofName}`,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    store.winnerClaims.push(claim);
    result.claimStatus = "pending";
    return claim;
  });
}

export async function reviewWinnerClaim(input: {
  claimId: string;
  status: ClaimStatus;
  note?: string;
  actorId: string;
}) {
  const store = getDemoStore();
  const claim = store.winnerClaims.find((candidate) => candidate.id === input.claimId);

  if (!claim) {
    throw new Error("Claim not found.");
  }

  const result = store.drawResults.find((candidate) => candidate.id === claim.drawResultId);
  if (!result) {
    throw new Error("Associated draw result not found.");
  }

  claim.status = input.status;
  claim.notes = input.note;
  claim.reviewedAt = new Date().toISOString();
  result.claimStatus = input.status;

  if (input.status === "paid") {
    const existingPayout = store.payoutLedger.find((entry) => entry.claimId === claim.id);
    if (!existingPayout) {
      store.payoutLedger.push({
        id: `payout-${Math.random().toString(36).slice(2, 10)}`,
        claimId: claim.id,
        userId: claim.userId,
        amountCents: result.prizeCents,
        status: "paid",
        recordedAt: new Date().toISOString(),
      });
    }
  }

  store.auditLogs.push({
    id: `audit-${Math.random().toString(36).slice(2, 10)}`,
    actorId: input.actorId,
    action: "claim.review",
    targetType: "winner_claim",
    targetId: claim.id,
    createdAt: new Date().toISOString(),
    summary: `Marked claim ${claim.id} as ${input.status}.`,
  });

  const profile = getProfile(claim.userId);
  if (profile) {
    await sendTransactionalEmail({
      to: profile.email,
      subject: `Claim ${input.status}`,
      html: `<p>Your winner claim is now <strong>${input.status}</strong>.</p>`,
    });
  }

  return claim;
}

export function resyncSubscription(subscriptionId: string) {
  return mutateDemoStore((store) => {
    const subscription = store.subscriptions.find((candidate) => candidate.id === subscriptionId);
    if (!subscription) {
      throw new Error("Subscription not found.");
    }

    subscription.updatedAt = new Date().toISOString();
    subscription.latestInvoiceStatus = subscription.status === "active" ? "paid" : "open";
    return subscription;
  });
}

export function buildAdminCsv() {
  const store = getDemoStore();
  const rows = [
    ["email", "role", "subscription_status", "charity", "tier", "latest_score_count"].join(","),
    ...store.profiles
      .filter((profile) => profile.role === "subscriber")
      .map((profile) => {
        const subscription = getSubscription(profile.id);
        const charity = getCharity(profile.selectedCharityId);
        const scores = getRollingFive(profile.id);
        return [
          profile.email,
          profile.role,
          subscription?.status ?? "inactive",
          charity?.name ?? "",
          String(profile.charityTier),
          String(scores.length),
        ].join(",");
      }),
  ];

  return rows.join("\n");
}

export function getAvailablePlanCards() {
  const store = getDemoStore();
  return store.plans.map((plan) => ({
    ...plan,
    tiers: plan.enabledTiers.map((tier) => ({
      tier,
      priceCents: getPlanPrice(plan.baseAmountCents, tier),
    })),
  }));
}

export async function getAvailableCharities(): Promise<Charity[]> {
  if (!isDemoMode()) {
    const { getLiveAvailableCharities } = await import("@/lib/live-platform");
    return getLiveAvailableCharities();
  }
  return getDemoStore().charities.filter((charity) => charity.active);
}

export function getDemoCredentials() {
  return {
    user: {
      email: "player@gooddrive.club",
      password: "Player@2026",
    },
    admin: {
      email: "admin@gooddrive.club",
      password: "Admin@2026",
    },
  };
}

export function getUserById(userId: string) {
  return getProfile(userId);
}

export function getSubscriberSubscription(userId: string): SubscriptionRecord | undefined {
  return getSubscription(userId);
}

export function getSubscriberScores(userId: string): ScoreEntry[] {
  return getRollingFive(userId);
}
