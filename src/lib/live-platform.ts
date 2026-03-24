/**
 * live-platform.ts
 *
 * All data-access functions that read/write directly to Supabase.
 * Called when isDemoMode() === false.
 * Mirror of the demo store API shape so callers can switch cleanly.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server-admin";
import { simulateDrawSummary } from "@/lib/logic/draws";
import { buildDashboardKpis } from "@/lib/logic/reports";
import { sortScoresDescending } from "@/lib/logic/scores";
import { sendTransactionalEmail } from "@/lib/resend";
import { formatCurrency } from "@/lib/utils";
import type {
  AuditLogEntry,
  Charity,
  CharityEvent,
  CharityTier,
  ClaimStatus,
  DashboardKpis,
  DonationLedgerEntry,
  DrawMode,
  DrawResult,
  FrequencyBias,
  MonthlyDraw,
  MonthlyDrawSummary,
  Plan,
  Profile,
  ScoreEntry,
  SubscriptionRecord,
  ViewerContext,
  WinnerClaim,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Row mappers (snake_case DB → camelCase app types)
// ---------------------------------------------------------------------------

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    fullName: (row.full_name as string) ?? "",
    email: row.email as string,
    role: row.role as "subscriber" | "admin",
    avatarUrl: row.avatar_url as string | undefined,
    selectedCharityId: (row.selected_charity_id as string) ?? "",
    charityTier: Number(row.charity_tier) as CharityTier,
    countryCode: (row.country_code as string) ?? "IN",
    currencyCode: (row.currency_code as string) ?? "INR",
    createdAt: row.created_at as string,
  };
}

function mapSubscription(row: Record<string, unknown>): SubscriptionRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    planId: row.plan_id as string,
    cadence: row.cadence as "monthly" | "yearly",
    status: row.status as SubscriptionRecord["status"],
    stripeCustomerId: row.stripe_customer_id as string | undefined,
    stripeSubscriptionId: row.stripe_subscription_id as string | undefined,
    stripePriceId: row.stripe_price_id as string | undefined,
    currentPeriodStart: (row.current_period_start as string) ?? "",
    currentPeriodEnd: (row.current_period_end as string) ?? "",
    cancelAtPeriodEnd: (row.cancel_at_period_end as boolean) ?? false,
    latestInvoiceStatus: (row.latest_invoice_status as string) ?? "",
    updatedAt: row.updated_at as string,
  };
}

function mapScore(row: Record<string, unknown>): ScoreEntry {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    score: row.score as number,
    playedAt: row.played_at as string,
    createdAt: row.created_at as string,
  };
}

function mapCharity(row: Record<string, unknown>, events: CharityEvent[] = []): Charity {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    category: row.category as string,
    impactTag: row.impact_tag as string,
    description: row.description as string,
    mission: row.mission as string,
    featured: (row.featured as boolean) ?? false,
    images: (row.gallery_urls as string[]) ?? [],
    upcomingEvents: events,
    totalRaisedCents: (row.total_raised_cents as number) ?? 0,
    active: (row.active as boolean) ?? true,
  };
}

function mapPlan(row: Record<string, unknown>): Plan {
  return {
    id: row.id as string,
    name: row.name as string,
    cadence: row.cadence as "monthly" | "yearly",
    baseAmountCents: row.base_amount_cents as number,
    yearlySavingsLabel: row.yearly_savings_label as string | undefined,
    stripeLookupKey: row.stripe_lookup_key as string,
    prizePoolBaseCents: row.prize_pool_base_cents as number,
    baseCharityPercent: Number(row.base_charity_percent) as CharityTier,
    enabledTiers: ((row.enabled_tiers as string[]) ?? []).map(Number) as CharityTier[],
  };
}

function mapDraw(row: Record<string, unknown>): MonthlyDraw {
  return {
    id: row.id as string,
    monthKey: row.month_key as string,
    drawMode: row.draw_mode as DrawMode,
    frequencyBias: row.frequency_bias as FrequencyBias | undefined,
    numbers: row.numbers as number[],
    publishedAt: row.published_at as string | undefined,
    prizePoolCents: (row.prize_pool_cents as number) ?? 0,
    rolloverFromPreviousCents: (row.rollover_from_previous_cents as number) ?? 0,
    fiveMatchPoolCents: (row.five_match_pool_cents as number) ?? 0,
    fourMatchPoolCents: (row.four_match_pool_cents as number) ?? 0,
    threeMatchPoolCents: (row.three_match_pool_cents as number) ?? 0,
    charityTotalCents: (row.charity_total_cents as number) ?? 0,
    simulationOnly: (row.simulation_only as boolean) ?? false,
  };
}

function mapDrawResult(row: Record<string, unknown>): DrawResult {
  return {
    id: row.id as string,
    drawId: row.draw_id as string,
    userId: row.user_id as string,
    matchedCount: row.matched_count as 3 | 4 | 5,
    tier: row.tier as DrawResult["tier"],
    prizeCents: (row.prize_cents as number) ?? 0,
    numbersMatched: (row.numbers_matched as number[]) ?? [],
    claimStatus: row.claim_status as ClaimStatus | undefined,
  };
}

function mapClaim(row: Record<string, unknown>): WinnerClaim {
  return {
    id: row.id as string,
    drawResultId: row.draw_result_id as string,
    userId: row.user_id as string,
    proofUrl: row.proof_path as string,
    notes: row.notes as string | undefined,
    status: row.status as ClaimStatus,
    createdAt: row.created_at as string,
    reviewedAt: row.reviewed_at as string | undefined,
  };
}

function mapAudit(row: Record<string, unknown>): AuditLogEntry {
  return {
    id: row.id as string,
    actorId: (row.actor_id as string) ?? "",
    action: row.action as string,
    targetType: row.target_type as string,
    targetId: row.target_id as string,
    createdAt: row.created_at as string,
    summary: row.summary as string,
  };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function getSupabase() {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase client unavailable");
  return client;
}

// ---------------------------------------------------------------------------
// Dashboard snapshot
// ---------------------------------------------------------------------------

export async function getLiveDashboardSnapshot(viewer: ViewerContext) {
  const supabase = await getSupabase();

  const [
    { data: planRows },
    { data: charityRow },
    { data: scoreRows },
    { data: resultsRows },
    { data: donationRows },
  ] = await Promise.all([
    supabase.from("plans").select("*"),
    supabase
      .from("charities")
      .select("*")
      .eq("id", viewer.profile.selectedCharityId)
      .single(),
    supabase
      .from("score_entries")
      .select("*")
      .eq("user_id", viewer.profile.id)
      .order("played_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("draw_results")
      .select("*, monthly_draws(*)")
      .eq("user_id", viewer.profile.id),
    supabase
      .from("donation_ledger")
      .select("*")
      .eq("user_id", viewer.profile.id)
      .order("recorded_at", { ascending: false }),
  ]);

  const plan = viewer.subscription
    ? (planRows ?? []).map(mapPlan).find((p) => p.id === viewer.subscription?.planId)
    : undefined;

  const charity = charityRow ? mapCharity(charityRow as Record<string, unknown>) : undefined;
  const scores = (scoreRows ?? []).map(mapScore);

  // Get winner claims for these results
  const resultIds = (resultsRows ?? []).map((r) => r.id as string);
  const { data: claimRows } = resultIds.length
    ? await supabase.from("winner_claims").select("*").in("draw_result_id", resultIds)
    : { data: [] };

  const results = (resultsRows ?? []).map((row) => {
    const result = mapDrawResult(row as Record<string, unknown>);
    const drawRow = row.monthly_draws as Record<string, unknown> | null;
    const draw = drawRow ? mapDraw(drawRow) : undefined;
    const claim = (claimRows ?? []).find((c) => c.draw_result_id === result.id);
    return { result, draw, claim: claim ? mapClaim(claim as Record<string, unknown>) : undefined };
  });

  const donationHistory: DonationLedgerEntry[] = (donationRows ?? []).map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    charityId: row.charity_id as string,
    amountCents: row.amount_cents as number,
    recordedAt: row.recorded_at as string,
  }));

  const totalWonCents = results.reduce((sum, e) => sum + e.result.prizeCents, 0);

  const getPlanPrice = (baseCents: number, tier: CharityTier) => {
    const uplift = Math.max(0, tier - 10);
    return Math.round(baseCents * (1 + uplift / 100));
  };

  const subscriptionPrice = plan ? getPlanPrice(plan.baseAmountCents, viewer.profile.charityTier) : 0;
  const upcomingMonth = new Date().toISOString().slice(0, 7);

  return { plan, charity, scores, results, donationHistory, totalWonCents, subscriptionPrice, upcomingMonth };
}

// ---------------------------------------------------------------------------
// Admin snapshot
// ---------------------------------------------------------------------------

export async function getLiveAdminSnapshot() {
  const supabase = await getSupabase();

  const [
    { data: subsRows },
    { data: profileRows },
    { data: claimRows },
    { data: charityRows },
    { data: planRows },
    { data: auditRows },
    { data: charityLedgerRows },
    { data: donationRows },
    { data: payoutRows },
    { data: drawRows },
    { data: scoreRows },
  ] = await Promise.all([
    supabase.from("subscriptions").select("*"),
    supabase.from("profiles").select("*"),
    supabase.from("winner_claims").select("*, draw_results(*, profiles(*))").order("created_at", { ascending: false }),
    supabase.from("charities").select("*"),
    supabase.from("plans").select("*"),
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(8),
    supabase.from("charity_ledger").select("*"),
    supabase.from("donation_ledger").select("*"),
    supabase.from("payout_ledger").select("*"),
    supabase.from("monthly_draws").select("*").eq("simulation_only", false).order("month_key", { ascending: false }),
    supabase.from("score_entries").select("*").order("played_at", { ascending: false }),
  ]);

  const profiles = (profileRows ?? []).map((r) => mapProfile(r as Record<string, unknown>));
  const subscriptions = (subsRows ?? []).map((r) => mapSubscription(r as Record<string, unknown>));
  const plans = (planRows ?? []).map((r) => mapPlan(r as Record<string, unknown>));
  const charities = (charityRows ?? []).map((r) => mapCharity(r as Record<string, unknown>));
  const allScores = (scoreRows ?? []).map((r) => mapScore(r as Record<string, unknown>));
  const draws = (drawRows ?? []).map((r) => mapDraw(r as Record<string, unknown>));

  const kpis: DashboardKpis = buildDashboardKpis({
    subscriptions,
    draws,
    charityLedger: (charityLedgerRows ?? []).map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      charityId: r.charity_id as string,
      amountCents: r.amount_cents as number,
      source: r.source as "subscription" | "donation",
      recordedAt: r.recorded_at as string,
    })),
    donations: (donationRows ?? []).map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      charityId: r.charity_id as string,
      amountCents: r.amount_cents as number,
      recordedAt: r.recorded_at as string,
    })),
    payouts: (payoutRows ?? []).map((r) => ({
      id: r.id as string,
      claimId: r.claim_id as string,
      userId: r.user_id as string,
      amountCents: r.amount_cents as number,
      status: r.status as "pending" | "paid",
      recordedAt: r.recorded_at as string,
    })),
  });

  const getRollingFive = (userId: string) =>
    sortScoresDescending(allScores.filter((s) => s.userId === userId)).slice(0, 5);

  const users = profiles
    .filter((p) => p.role === "subscriber")
    .map((profile) => ({
      profile,
      subscription: subscriptions.find((s) => s.userId === profile.id),
      scores: getRollingFive(profile.id),
    }));
  const admins = profiles
    .filter((profile) => profile.role === "admin")
    .map((profile) => ({
      profile,
    }));

  const claims = (claimRows ?? []).map((row) => {
    const claim = mapClaim(row as Record<string, unknown>);
    const resultRow = row.draw_results as Record<string, unknown> | null;
    const result = resultRow ? mapDrawResult(resultRow) : undefined;
    const profileRow = resultRow?.profiles as Record<string, unknown> | null;
    const user = profileRow ? mapProfile(profileRow) : undefined;
    return { claim, result, user };
  });

  const latestDraw = draws[0];
  const audits = (auditRows ?? []).map((r) => mapAudit(r as Record<string, unknown>));

  return { kpis, users, admins, claims, latestDraw, charities, plans, audits };
}

// ---------------------------------------------------------------------------
// Charity directory
// ---------------------------------------------------------------------------

export async function getLiveCharityDirectory() {
  const supabase = await getSupabase();
  const { data: rows } = await supabase.from("charities").select("*").eq("active", true);
  const charities = (rows ?? []).map((r) => mapCharity(r as Record<string, unknown>));
  const categories = Array.from(new Set(charities.map((c) => c.category)));
  return { charities, categories };
}

export async function getLiveCharityPage(slug: string) {
  const supabase = await getSupabase();
  const { data: charityRow } = await supabase.from("charities").select("*").eq("slug", slug).single();
  if (!charityRow) return null;

  const { data: eventRows } = await supabase
    .from("charity_events")
    .select("*")
    .eq("charity_id", charityRow.id as string)
    .order("event_at", { ascending: true });

  const events: CharityEvent[] = (eventRows ?? []).map((r) => ({
    id: r.id as string,
    charityId: r.charity_id as string,
    title: r.title as string,
    date: r.event_at as string,
    location: r.location as string,
    summary: r.summary as string,
  }));

  const charity = mapCharity(charityRow as Record<string, unknown>, events);

  const { data: related } = await supabase
    .from("charities")
    .select("*")
    .eq("category", charityRow.category as string)
    .neq("id", charityRow.id as string)
    .limit(2);

  return { charity, related: (related ?? []).map((r) => mapCharity(r as Record<string, unknown>)) };
}

// ---------------------------------------------------------------------------
// Score mutations
// ---------------------------------------------------------------------------

export async function saveLiveScore(
  userId: string,
  input: { score: number; playedAt: string; id?: string },
) {
  const supabase = await getSupabase();

  if (input.id) {
    await supabase
      .from("score_entries")
      .update({ score: input.score, played_at: input.playedAt })
      .eq("id", input.id)
      .eq("user_id", userId);
  } else {
    await supabase.from("score_entries").insert({
      user_id: userId,
      score: input.score,
      played_at: input.playedAt,
    });
  }
  // Trigger enforce_latest_five_scores fires automatically on insert/update
}

export async function deleteLiveScore(userId: string, scoreId: string) {
  const supabase = await getSupabase();
  await supabase.from("score_entries").delete().eq("id", scoreId).eq("user_id", userId);
}

export async function updateLivePreferences(
  userId: string,
  input: { charityId: string; charityTier: CharityTier },
) {
  const supabase = await getSupabase();
  await supabase
    .from("profiles")
    .update({ selected_charity_id: input.charityId, charity_tier: String(input.charityTier) })
    .eq("id", userId);
}

// ---------------------------------------------------------------------------
// Winner claims
// ---------------------------------------------------------------------------

export async function submitLiveClaim(
  userId: string,
  input: { drawResultId: string; proofPath: string },
) {
  const supabase = await getSupabase();

  // Upsert claim row
  const { data: existing } = await supabase
    .from("winner_claims")
    .select("id")
    .eq("draw_result_id", input.drawResultId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("winner_claims")
      .update({ proof_path: input.proofPath, status: "pending", reviewed_at: null })
      .eq("id", existing.id as string);
  } else {
    await supabase.from("winner_claims").insert({
      draw_result_id: input.drawResultId,
      user_id: userId,
      proof_path: input.proofPath,
      status: "pending",
    });
  }

  await supabase
    .from("draw_results")
    .update({ claim_status: "pending" })
    .eq("id", input.drawResultId);
}

// ---------------------------------------------------------------------------
// Admin: draw publish
// ---------------------------------------------------------------------------

export async function publishLiveDraw(input: {
  monthKey: string;
  mode: DrawMode;
  bias?: FrequencyBias;
  actorId: string;
}) {
  const supabase = await getSupabase();

  // Get all data needed for simulation
  const [{ data: subsRows }, { data: planRows }, { data: profileRows }, { data: scoreRows }] =
    await Promise.all([
      supabase.from("subscriptions").select("*").eq("status", "active"),
      supabase.from("plans").select("*"),
      supabase.from("profiles").select("*").eq("role", "subscriber"),
      supabase.from("score_entries").select("*"),
    ]);

  const subscriptions = (subsRows ?? []).map((r) => mapSubscription(r as Record<string, unknown>));
  const plans = (planRows ?? []).map((r) => mapPlan(r as Record<string, unknown>));
  const profiles = (profileRows ?? []).map((r) => mapProfile(r as Record<string, unknown>));
  const scores = (scoreRows ?? []).map((r) => mapScore(r as Record<string, unknown>));

  // Get charity totals for the month
  const monthStart = `${input.monthKey}-01`;
  const [{ data: ledgerRows }, { data: donationRows }] = await Promise.all([
    supabase.from("charity_ledger").select("amount_cents").gte("recorded_at", monthStart),
    supabase.from("donation_ledger").select("amount_cents").gte("recorded_at", monthStart),
  ]);
  const charityTotalCents = [
    ...(ledgerRows ?? []),
    ...(donationRows ?? []),
  ].reduce((sum, r) => sum + (r.amount_cents as number), 0);

  // Get rollover from previous published draw
  const { data: prevDrawRow } = await supabase
    .from("monthly_draws")
    .select("five_match_pool_cents, month_key")
    .eq("simulation_only", false)
    .not("published_at", "is", null)
    .order("month_key", { ascending: false })
    .limit(1)
    .maybeSingle();

  let rolloverFromPreviousCents = 0;
  if (prevDrawRow && prevDrawRow.month_key !== `${input.monthKey}-01`) {
    const { count } = await supabase
      .from("draw_results")
      .select("id", { count: "exact", head: true })
      .eq("tier", "five_match");
    if (!count || count === 0) {
      rolloverFromPreviousCents = (prevDrawRow.five_match_pool_cents as number) ?? 0;
    }
  }

  const summary: MonthlyDrawSummary = simulateDrawSummary({
    monthKey: input.monthKey,
    mode: input.mode,
    bias: input.bias,
    subscriptions,
    plans,
    profiles,
    scores,
    charityTotalCents,
    rolloverFromPreviousCents,
  });

  // Insert draw row
  const { data: drawRow } = await supabase
    .from("monthly_draws")
    .insert({
      month_key: `${input.monthKey}-01`,
      draw_mode: input.mode,
      frequency_bias: input.bias ?? null,
      numbers: summary.draw.numbers,
      prize_pool_cents: summary.draw.prizePoolCents,
      rollover_from_previous_cents: rolloverFromPreviousCents,
      five_match_pool_cents: summary.draw.fiveMatchPoolCents,
      four_match_pool_cents: summary.draw.fourMatchPoolCents,
      three_match_pool_cents: summary.draw.threeMatchPoolCents,
      charity_total_cents: charityTotalCents,
      simulation_only: false,
      published_at: new Date().toISOString(),
      created_by: input.actorId,
    })
    .select("id")
    .single();

  if (drawRow) {
    const drawId = drawRow.id as string;
    // Insert draw results
    if (summary.provisionalResults.length > 0) {
      await supabase.from("draw_results").insert(
        summary.provisionalResults.map((r) => ({
          draw_id: drawId,
          user_id: r.userId,
          matched_count: r.matchedCount,
          tier: r.tier,
          prize_cents: r.prizeCents,
          numbers_matched: r.numbersMatched,
        })),
      );
    }

    // Write audit log
    await supabase.from("audit_logs").insert({
      actor_id: input.actorId,
      action: "draw.publish",
      target_type: "monthly_draw",
      target_id: drawId,
      summary: `Published ${input.monthKey} draw in ${input.mode} mode.`,
    });
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Admin: review claim
// ---------------------------------------------------------------------------

export async function reviewLiveClaim(input: {
  claimId: string;
  status: ClaimStatus;
  note?: string;
  actorId: string;
}) {
  const supabase = await getSupabase();

  const { data: claim } = await supabase
    .from("winner_claims")
    .select("*, draw_results(prize_cents, user_id), profiles!winner_claims_user_id_fkey(email, full_name)")
    .eq("id", input.claimId)
    .single();

  if (!claim) throw new Error("Claim not found");

  await supabase.from("winner_claims").update({
    status: input.status,
    notes: input.note ?? null,
    reviewed_by: input.actorId,
    reviewed_at: new Date().toISOString(),
  }).eq("id", input.claimId);

  const drawResult = claim.draw_results as { prize_cents: number; user_id: string } | null;
  if (drawResult) {
    await supabase.from("draw_results").update({ claim_status: input.status }).eq("id", claim.draw_result_id as string);

    if (input.status === "paid") {
      await supabase.from("payout_ledger").upsert({
        claim_id: input.claimId,
        user_id: drawResult.user_id,
        amount_cents: drawResult.prize_cents,
        status: "paid",
        paid_at: new Date().toISOString(),
      }, { onConflict: "claim_id" });
    }
  }

  await supabase.from("audit_logs").insert({
    actor_id: input.actorId,
    action: "claim.review",
    target_type: "winner_claim",
    target_id: input.claimId,
    summary: `Marked claim ${input.claimId} as ${input.status}.`,
  });

  // Email notification
  const profile = claim.profiles as { email: string; full_name: string } | null;
  if (profile) {
    await sendTransactionalEmail({
      to: profile.email,
      subject: `Your winner claim is now ${input.status}`,
      html: `<p>Hi ${profile.full_name}, your winner claim status has been updated to <strong>${input.status}</strong>.</p>`,
    });
  }
}

// ---------------------------------------------------------------------------
// Admin: resync subscription
// ---------------------------------------------------------------------------

export async function resyncLiveSubscription(subscriptionId: string) {
  const supabase = await getSupabase();
  await supabase
    .from("subscriptions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", subscriptionId);
}

// ---------------------------------------------------------------------------
// Admin: delete user
// ---------------------------------------------------------------------------

export async function deleteLiveUser(profileId: string) {
  const supabase = await getSupabase();
  const admin = createSupabaseAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("auth_user_id")
    .eq("id", profileId)
    .single();

  await supabase.from("profiles").delete().eq("id", profileId);

  if (profile?.auth_user_id && admin) {
    await admin.auth.admin.deleteUser(profile.auth_user_id as string);
  }
}

// ---------------------------------------------------------------------------
// Admin: record donation (live)
// ---------------------------------------------------------------------------

export async function recordLiveDonation(
  userId: string,
  charityId: string,
  amountCents: number,
  stripePaymentIntentId?: string,
) {
  const supabase = await getSupabase();

  await supabase.from("donation_ledger").insert({
    user_id: userId,
    charity_id: charityId,
    amount_cents: amountCents,
    stripe_payment_intent_id: stripePaymentIntentId ?? null,
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .single();

  if (profile) {
    await sendTransactionalEmail({
      to: profile.email as string,
      subject: "Your donation has been recorded",
      html: `<p>Hi ${profile.full_name as string}, thanks for your ${formatCurrency(amountCents)} donation. It will be included in this month's charity report.</p>`,
    });
  }
}

// ---------------------------------------------------------------------------
// Live available charities (for sign-up / dashboard selects)
// ---------------------------------------------------------------------------

export async function getLiveAvailableCharities(): Promise<Charity[]> {
  const supabase = await getSupabase();
  const { data } = await supabase.from("charities").select("*").eq("active", true);
  return (data ?? []).map((r) => mapCharity(r as Record<string, unknown>));
}

// ---------------------------------------------------------------------------
// Live plans (for pricing page)
// ---------------------------------------------------------------------------

export async function getLivePlans(): Promise<Plan[]> {
  const supabase = await getSupabase();
  const { data } = await supabase.from("plans").select("*").eq("is_active", true);
  return (data ?? []).map((r) => mapPlan(r as Record<string, unknown>));
}

// ---------------------------------------------------------------------------
// Live home snapshot
// ---------------------------------------------------------------------------

export async function getLiveHomeSnapshot() {
  const supabase = await getSupabase();
  const [
    { data: charityRows },
    { data: planRows },
    { data: subsRows },
    { data: drawRows },
    { data: charityLedgerRows },
    { data: donationRows },
    { data: payoutRows },
  ] = await Promise.all([
    supabase.from("charities").select("*").eq("active", true),
    supabase.from("plans").select("*").eq("is_active", true),
    supabase.from("subscriptions").select("*"),
    supabase.from("monthly_draws").select("*").eq("simulation_only", false),
    supabase.from("charity_ledger").select("*"),
    supabase.from("donation_ledger").select("*"),
    supabase.from("payout_ledger").select("*"),
  ]);

  const charities = (charityRows ?? []).map((r) => mapCharity(r as Record<string, unknown>));
  const plans = (planRows ?? []).map((r) => mapPlan(r as Record<string, unknown>));
  const subscriptions = (subsRows ?? []).map((r) => mapSubscription(r as Record<string, unknown>));
  const draws = (drawRows ?? []).map((r) => mapDraw(r as Record<string, unknown>));

  const getPlanPrice = (baseCents: number, tier: CharityTier) => {
    const uplift = Math.max(0, tier - 10);
    return Math.round(baseCents * (1 + uplift / 100));
  };

  const kpis = buildDashboardKpis({
    subscriptions,
    draws,
    charityLedger: (charityLedgerRows ?? []).map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      charityId: r.charity_id as string,
      amountCents: r.amount_cents as number,
      source: r.source as "subscription" | "donation",
      recordedAt: r.recorded_at as string,
    })),
    donations: (donationRows ?? []).map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      charityId: r.charity_id as string,
      amountCents: r.amount_cents as number,
      recordedAt: r.recorded_at as string,
    })),
    payouts: (payoutRows ?? []).map((r) => ({
      id: r.id as string,
      claimId: r.claim_id as string,
      userId: r.user_id as string,
      amountCents: r.amount_cents as number,
      status: r.status as "pending" | "paid",
      recordedAt: r.recorded_at as string,
    })),
  });

  const featuredCharity = charities.find((c) => c.featured) ?? charities[0];
  const plansWithPrices = plans.map((plan) => ({
    ...plan,
    previewPriceCents: getPlanPrice(plan.baseAmountCents, plan.baseCharityPercent),
  }));
  const currentMonth = new Date().toISOString().slice(0, 7);

  return {
    featuredCharity,
    charities,
    plans: plansWithPrices,
    kpis,
    currentMonth,
  };
}
