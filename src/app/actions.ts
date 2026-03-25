"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearDemoSession, createDemoSession, requireAdmin, requireViewer } from "@/lib/session";
import {
  activateDemoSubscription,
  authenticateDemoUser,
  createDemoAdminAccount,
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
import { createSupabaseAdminClient } from "@/lib/supabase/server-admin";
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
  const requestedRole = (formData.get("requestedRole") as string | null) ?? "subscriber";

  if (isDemoMode()) {
    const profile = authenticateDemoUser(email, password);
    if (!profile) {
      redirect(requestedRole === "admin" ? "/admin/login?error=invalid-credentials" : "/sign-in?error=invalid-credentials");
    }
    if (requestedRole === "admin" && profile.role !== "admin") {
      redirect("/admin/login?error=admin-only-account");
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

  if (requestedRole === "admin" && profile?.role !== "admin") {
    await supabase.auth.signOut();
    redirect("/admin/login?error=admin-only-account");
  }

  redirect(profile?.role === "admin" ? "/admin" : "/dashboard");
}

export async function signupAction(formData: FormData) {
  const fullName = getRequiredString(formData, "fullName");
  const email = getRequiredString(formData, "email");
  const password = getRequiredString(formData, "password");
  const charityId = getRequiredString(formData, "charityId");
  const charityTier = Number(getRequiredString(formData, "charityTier")) as CharityTier;

  if (isDemoMode()) {
    let profile;
    try {
      profile = createDemoSubscriber({ fullName, email, password, selectedCharityId: charityId, charityTier });
    } catch (error) {
      redirect(`/sign-in?error=${error instanceof Error ? "signup-failed" : "signup-failed"}`);
    }
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

  // Update or create the profile row linked to auth user. A trigger may already
  // have created a minimal profile record on auth.users insert.
  await supabase!.from("profiles").upsert({
    auth_user_id: signUpData.user.id,
    full_name: fullName,
    email: email.toLowerCase(),
    role: "subscriber",
    selected_charity_id: charityId,
    charity_tier: String(charityTier),
    country_code: "IN",
    currency_code: "INR",
  }, { onConflict: "auth_user_id" });

  redirect("/pricing?welcome=1");
}

export async function demoSubscriptionAction(formData: FormData) {
  const viewer = await requireViewer();
  if (!isDemoMode()) {
    redirect("/pricing?status=reactivate-subscription");
  }
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
  
  let success = false;
  try {
    const scoreId = (formData.get("scoreId") as string) || undefined;
    
    // Extract safely instead of throwing in helper
    const scoreVal = formData.get("score");
    const playedAtVal = formData.get("playedAt");
    
    if (!scoreVal || !playedAtVal) {
      throw new Error("Missing score or date");
    }

    await saveUserScore(viewer.profile.id, {
      id: scoreId,
      score: Number(scoreVal),
      playedAt: String(playedAtVal),
    });
    success = true;
  } catch (error) {
    console.error("Save score action failed:", error);
  }

  if (!success) {
    redirect("/dashboard?error=invalid-score");
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?status=score-saved");
}

export async function deleteScoreAction(formData: FormData) {
  const viewer = await requireViewer();
  const scoreId = getRequiredString(formData, "scoreId");
  await deleteUserScore(viewer.profile.id, scoreId);
  revalidatePath("/dashboard");
  redirect("/dashboard?status=score-deleted");
}

export async function updatePreferencesAction(formData: FormData) {
  const viewer = await requireViewer();
  let success = false;
  try {
    await updateUserPreferences(viewer.profile.id, {
      charityId: getRequiredString(formData, "charityId"),
      charityTier: Number(getRequiredString(formData, "charityTier")) as CharityTier,
    });
    success = true;
  } catch (err) {
    console.error("Failed to update preferences:", err);
  }

  if (!success) {
    redirect("/dashboard?error=preferences-failed");
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?status=preferences-saved");
}

export async function submitClaimAction(formData: FormData) {
  const viewer = await requireViewer();
  const proof = formData.get("proof");
  const drawResultId = getRequiredString(formData, "drawResultId");

  if (!isDemoMode()) {
    if (!(proof instanceof File) || !proof.name) {
      redirect("/dashboard?error=proof-required");
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      redirect("/dashboard?error=upload-failed");
    }

    const {
      data: { user },
    } = await supabase!.auth.getUser();

    if (!user) {
      redirect("/sign-in");
    }

    const ext = proof.name.split(".").pop() ?? "png";
    const proofPath = `${user!.id}/${drawResultId}/proof.${ext}`;
    const fileBuffer = await proof.arrayBuffer();
    const { error } = await supabase!.storage.from("winner-proofs").upload(proofPath, fileBuffer, {
      contentType: proof.type || "application/octet-stream",
      upsert: true,
    });

    if (error) {
      redirect("/dashboard?error=upload-failed");
    }

    const { submitLiveClaim } = await import("@/lib/live-platform");
    await submitLiveClaim(viewer.profile.id, {
      drawResultId,
      proofPath,
    });

    revalidatePath("/dashboard");
    redirect("/dashboard?status=claim-submitted");
  }

  submitWinnerClaim(viewer.profile.id, {
    drawResultId,
    proofName: proof instanceof File && proof.name ? proof.name : "demo-proof.png",
  });
  revalidatePath("/dashboard");
  redirect("/dashboard?status=claim-submitted");
}

export async function publishDrawAction(formData: FormData) {
  const viewer = await requireAdmin();
  if (!isDemoMode()) {
    const { publishLiveDraw } = await import("@/lib/live-platform");
    try {
      await publishLiveDraw({
        actorId: viewer.profile.id,
        monthKey: getRequiredString(formData, "monthKey"),
        mode: getRequiredString(formData, "mode") as DrawMode,
        bias: (formData.get("bias") as FrequencyBias | null) ?? undefined,
      });
    } catch {
      redirect("/admin?error=draw-publish-failed");
    }
    revalidatePath("/admin");
    redirect("/admin?status=draw-published");
  }
  try {
    publishMonthlyDraw({
      actorId: viewer.profile.id,
      monthKey: getRequiredString(formData, "monthKey"),
      mode: getRequiredString(formData, "mode") as DrawMode,
      bias: (formData.get("bias") as FrequencyBias | null) ?? undefined,
    });
  } catch {
    redirect("/admin?error=draw-publish-failed");
  }
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

export async function adminCreateAccountAction(formData: FormData) {
  await requireAdmin();

  const fullName = getRequiredString(formData, "fullName");
  const email = getRequiredString(formData, "email");
  const password = getRequiredString(formData, "password");
  const role = getRequiredString(formData, "role") as "subscriber" | "admin";

  if (!isDemoMode()) {
    const admin = createSupabaseAdminClient();
    if (!admin) {
      redirect("/admin?error=admin-client-unavailable");
    }

    const { data: created, error } = await admin!.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        country_code: "IN",
        currency_code: "INR",
      },
    });

    if (error || !created.user) {
      redirect("/admin?error=account-create-failed");
    }

    const supabase = await createSupabaseServerClient();
    const { data: charity } = await supabase!
      .from("charities")
      .select("id")
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    await supabase!.from("profiles").upsert({
      auth_user_id: created.user.id,
      full_name: fullName,
      email: email.toLowerCase(),
      role,
      selected_charity_id: charity?.id ?? null,
      charity_tier: "10",
      country_code: "IN",
      currency_code: "INR",
    }, { onConflict: "auth_user_id" });

    revalidatePath("/admin");
    redirect("/admin?status=account-created");
  }

  try {
    createDemoAdminAccount({
      fullName,
      email,
      password,
      role,
    });
  } catch {
    redirect("/admin?error=account-create-failed");
  }

  revalidatePath("/admin");
  redirect("/admin?status=account-created");
}
