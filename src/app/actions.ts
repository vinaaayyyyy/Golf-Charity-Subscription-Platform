"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearDemoSession, createDemoSession, requireAdmin, requireViewer } from "@/lib/session";
import {
  activateDemoSubscription,
  authenticateDemoUser,
  createDemoSubscriber,
  deleteUserScore,
  publishMonthlyDraw,
  resyncSubscription,
  reviewWinnerClaim,
  saveUserScore,
  submitWinnerClaim,
  updateUserPreferences,
} from "@/lib/platform";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CharityTier, ClaimStatus, DrawMode, FrequencyBias } from "@/lib/types";

function getRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing field: ${key}`);
  }
  return value.trim();
}

export async function loginAction(formData: FormData) {
  const email = getRequiredString(formData, "email");
  const password = getRequiredString(formData, "password");

  if (isDemoMode()) {
    const profile = authenticateDemoUser(email, password);
    if (!profile) {
      redirect("/sign-in?error=invalid-credentials");
    }
    await createDemoSession(profile);
    redirect(profile.role === "admin" ? "/admin" : "/dashboard");
  }

  // Live mode: Supabase email/password sign-in
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect("/sign-in?error=server-error");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect("/sign-in?error=invalid-credentials");
  }

  // Determine role from profiles table
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?error=invalid-credentials");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_user_id", user!.id)
    .single();

  redirect(profile?.role === "admin" ? "/admin" : "/dashboard");
}

export async function signupAction(formData: FormData) {
  const fullName = getRequiredString(formData, "fullName");
  const email = getRequiredString(formData, "email");
  const password = getRequiredString(formData, "password");
  const charityId = getRequiredString(formData, "charityId");
  const charityTier = Number(getRequiredString(formData, "charityTier")) as CharityTier;

  if (isDemoMode()) {
    const profile = createDemoSubscriber({ fullName, email, password, selectedCharityId: charityId, charityTier });
    await createDemoSession(profile);
    redirect("/pricing?welcome=1");
  }

  // Live mode: create Supabase Auth user
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/sign-in?error=server-error");

  const { data: signUpData, error: signUpError } = await supabase!.auth.signUp({ email, password });
  if (signUpError || !signUpData.user) {
    redirect("/sign-in?error=signup-failed");
  }

  // Insert profile row linked to auth user
  await supabase!.from("profiles").insert({
    auth_user_id: signUpData.user.id,
    full_name: fullName,
    email: email.toLowerCase(),
    role: "subscriber",
    selected_charity_id: charityId,
    charity_tier: String(charityTier),
    country_code: "IN",
    currency_code: "INR",
  });

  redirect("/pricing?welcome=1");
}

export async function demoSubscriptionAction(formData: FormData) {
  const viewer = await requireViewer();
  activateDemoSubscription(
    viewer.profile.id,
    getRequiredString(formData, "cadence") as "monthly" | "yearly",
    Number(getRequiredString(formData, "charityTier")) as CharityTier,
  );
  revalidatePath("/dashboard");
  redirect("/dashboard?billing=activated");
}

export async function logoutAction() {
  if (!isDemoMode()) {
    const supabase = await createSupabaseServerClient();
    if (supabase) await supabase.auth.signOut();
  }
  await clearDemoSession();
  redirect("/");
}

export async function saveScoreAction(formData: FormData) {
  const viewer = await requireViewer();
  saveUserScore(viewer.profile.id, {
    id: (formData.get("scoreId") as string) || undefined,
    score: Number(getRequiredString(formData, "score")),
    playedAt: getRequiredString(formData, "playedAt"),
  });
  revalidatePath("/dashboard");
  redirect("/dashboard?status=score-saved");
}

export async function deleteScoreAction(formData: FormData) {
  const viewer = await requireViewer();
  const scoreId = getRequiredString(formData, "scoreId");
  deleteUserScore(viewer.profile.id, scoreId);
  revalidatePath("/dashboard");
  redirect("/dashboard?status=score-deleted");
}

export async function updatePreferencesAction(formData: FormData) {
  const viewer = await requireViewer();
  updateUserPreferences(viewer.profile.id, {
    charityId: getRequiredString(formData, "charityId"),
    charityTier: Number(getRequiredString(formData, "charityTier")) as CharityTier,
  });
  revalidatePath("/dashboard");
  redirect("/dashboard?status=preferences-saved");
}

export async function submitClaimAction(formData: FormData) {
  const viewer = await requireViewer();
  const proof = formData.get("proof");
  submitWinnerClaim(viewer.profile.id, {
    drawResultId: getRequiredString(formData, "drawResultId"),
    proofName: proof instanceof File && proof.name ? proof.name : "demo-proof.png",
  });
  revalidatePath("/dashboard");
  redirect("/dashboard?status=claim-submitted");
}

export async function publishDrawAction(formData: FormData) {
  const viewer = await requireAdmin();
  if (!isDemoMode()) {
    const { publishLiveDraw } = await import("@/lib/live-platform");
    await publishLiveDraw({
      actorId: viewer.profile.id,
      monthKey: getRequiredString(formData, "monthKey"),
      mode: getRequiredString(formData, "mode") as DrawMode,
      bias: (formData.get("bias") as FrequencyBias | null) ?? undefined,
    });
    revalidatePath("/admin");
    redirect("/admin?status=draw-published");
  }
  publishMonthlyDraw({
    actorId: viewer.profile.id,
    monthKey: getRequiredString(formData, "monthKey"),
    mode: getRequiredString(formData, "mode") as DrawMode,
    bias: (formData.get("bias") as FrequencyBias | null) ?? undefined,
  });
  revalidatePath("/admin");
  redirect("/admin?status=draw-published");
}

export async function reviewClaimAction(formData: FormData) {
  const viewer = await requireAdmin();
  if (!isDemoMode()) {
    const { reviewLiveClaim } = await import("@/lib/live-platform");
    await reviewLiveClaim({
      actorId: viewer.profile.id,
      claimId: getRequiredString(formData, "claimId"),
      status: getRequiredString(formData, "status") as ClaimStatus,
      note: (formData.get("note") as string) || undefined,
    });
    revalidatePath("/admin");
    revalidatePath("/dashboard");
    redirect("/admin?status=claim-reviewed");
  }
  await reviewWinnerClaim({
    actorId: viewer.profile.id,
    claimId: getRequiredString(formData, "claimId"),
    status: getRequiredString(formData, "status") as ClaimStatus,
    note: (formData.get("note") as string) || undefined,
  });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  redirect("/admin?status=claim-reviewed");
}

export async function adminResyncSubscriptionAction(formData: FormData) {
  await requireAdmin();
  if (!isDemoMode()) {
    const { resyncLiveSubscription } = await import("@/lib/live-platform");
    await resyncLiveSubscription(getRequiredString(formData, "subscriptionId"));
    revalidatePath("/admin");
    redirect("/admin?status=subscription-resynced");
  }
  resyncSubscription(getRequiredString(formData, "subscriptionId"));
  revalidatePath("/admin");
  redirect("/admin?status=subscription-resynced");
}

export async function adminDeleteUserAction(formData: FormData) {
  await requireAdmin();
  const profileId = getRequiredString(formData, "profileId");

  if (!isDemoMode()) {
    const { deleteLiveUser } = await import("@/lib/live-platform");
    await deleteLiveUser(profileId);
    revalidatePath("/admin");
    redirect("/admin?status=user-deleted");
  }

  // Demo mode: remove from in-memory store
  const { mutateDemoStore } = await import("@/lib/demo-store");
  mutateDemoStore((store) => {
    store.profiles = store.profiles.filter((p) => p.id !== profileId);
    store.subscriptions = store.subscriptions.filter((s) => s.userId !== profileId);
    store.scoreEntries = store.scoreEntries.filter((s) => s.userId !== profileId);
    store.demoAccounts = store.demoAccounts.filter((a) => a.userId !== profileId);
  });
  revalidatePath("/admin");
  redirect("/admin?status=user-deleted");
}
