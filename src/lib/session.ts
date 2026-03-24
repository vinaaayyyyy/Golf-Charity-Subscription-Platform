"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDemoStore } from "@/lib/demo-store";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile, ViewerContext } from "@/lib/types";

const DEMO_SESSION_COOKIE = "good-drive-demo-session";
const DEMO_ROLE_COOKIE = "good-drive-demo-role";

function encode(payload: { userId: string }) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decode(value?: string) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { userId: string };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Live mode: resolve viewer from Supabase Auth session
// ---------------------------------------------------------------------------
async function getLiveViewer(): Promise<ViewerContext | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile) return null;

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();

  const mapped: Profile = {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    role: profile.role,
    selectedCharityId: profile.selected_charity_id,
    charityTier: profile.charity_tier,
    countryCode: profile.country_code,
    currencyCode: profile.currency_code,
    createdAt: profile.created_at,
  };

  const mappedSub = subscription
    ? {
        id: subscription.id,
        userId: subscription.user_id,
        planId: subscription.plan_id,
        cadence: subscription.cadence,
        status: subscription.status,
        stripeCustomerId: subscription.stripe_customer_id,
        stripeSubscriptionId: subscription.stripe_subscription_id,
        stripePriceId: subscription.stripe_price_id,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        latestInvoiceStatus: subscription.latest_invoice_status,
        updatedAt: subscription.updated_at,
      }
    : undefined;

  return {
    profile: mapped,
    subscription: mappedSub,
    isActiveSubscriber: mappedSub?.status === "active" || mapped.role === "admin",
  };
}

// ---------------------------------------------------------------------------
// Demo mode: resolve viewer from in-memory cookie session
// ---------------------------------------------------------------------------
async function getDemoViewer(): Promise<ViewerContext | null> {
  const cookieStore = await cookies();
  const session = decode(cookieStore.get(DEMO_SESSION_COOKIE)?.value);

  if (!session) return null;

  const store = getDemoStore();
  const profile = store.profiles.find((candidate) => candidate.id === session.userId);

  if (!profile) return null;

  const subscription = store.subscriptions.find((candidate) => candidate.userId === profile.id);

  return {
    profile,
    subscription,
    isActiveSubscriber: subscription?.status === "active" || profile.role === "admin",
  };
}

export async function getCurrentViewer(): Promise<ViewerContext | null> {
  if (isDemoMode()) {
    return getDemoViewer();
  }
  // In live mode: try Supabase first, fall back to demo cookie if no Supabase session
  const liveViewer = await getLiveViewer();
  if (liveViewer) return liveViewer;
  return getDemoViewer();
}

export async function requireViewer() {
  const viewer = await getCurrentViewer();
  if (!viewer) {
    redirect("/sign-in");
  }
  return viewer;
}

export async function requireAdmin() {
  const viewer = await requireViewer();
  if (viewer.profile.role !== "admin") {
    redirect("/dashboard?error=admin-only");
  }
  return viewer;
}

export async function createDemoSession(profile: Profile) {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_SESSION_COOKIE, encode({ userId: profile.id }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  cookieStore.set(DEMO_ROLE_COOKIE, profile.role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearDemoSession() {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_SESSION_COOKIE);
  cookieStore.delete(DEMO_ROLE_COOKIE);
}
