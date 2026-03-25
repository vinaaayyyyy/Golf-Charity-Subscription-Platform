import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getStripeServer } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/server-admin";
import { sendTransactionalEmail } from "@/lib/resend";

export async function POST(request: Request) {
  const stripe = getStripeServer();
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  if (!stripe || !env.stripeWebhookSecret || !signature) {
    return NextResponse.json({ received: true, mode: "demo" });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.stripeWebhookSecret);
  } catch (error) {
    return NextResponse.json(
      { received: false, error: error instanceof Error ? error.message : "Invalid webhook signature" },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error("Supabase admin client unavailable — webhook received but not persisted", event.type);
    return NextResponse.json({ received: true, type: event.type, warning: "db-unavailable" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as {
          metadata?: { userId?: string; charityId?: string; charityTier?: string; cadence?: string };
          customer?: string;
          subscription?: string;
          payment_intent?: string;
          mode?: string;
          amount_total?: number;
        };
        const { userId, charityId, charityTier, cadence } = session.metadata ?? {};

        if (session.mode === "subscription" && userId && cadence) {
          // Get plan for cadence
          const { data: plan } = await supabase
            .from("plans")
            .select("id")
            .eq("cadence", cadence)
            .eq("is_active", true)
            .single();

          if (plan) {
            await supabase.from("subscriptions").upsert(
              {
                user_id: userId,
                plan_id: plan.id,
                cadence,
                status: "active",
                charity_tier: charityTier ?? "10",
                stripe_customer_id: session.customer as string | undefined,
                stripe_subscription_id: session.subscription as string | undefined,
                latest_invoice_status: "paid",
              },
              { onConflict: "stripe_subscription_id" },
            );

            // Record charity allocation
            if (charityId) {
              const tier = Number(charityTier ?? 10);
              const { data: planRow } = await supabase.from("plans").select("base_amount_cents").eq("id", plan.id).single();
              if (planRow) {
                const uplift = Math.max(0, tier - 10);
                const price = Math.round((planRow.base_amount_cents as number) * (1 + uplift / 100));
                const charityAmount = Math.round(price * (tier / 100));
                await supabase.from("charity_ledger").insert({
                  user_id: userId,
                  charity_id: charityId,
                  source: "subscription",
                  amount_cents: charityAmount,
                });
              }
            }
          }
        } else if (session.mode === "payment" && userId && charityId) {
          // Independent donation checkout completed
          await supabase.from("donation_ledger").insert({
            user_id: userId,
            charity_id: charityId,
            amount_cents: session.amount_total ?? 0,
            stripe_payment_intent_id: session.payment_intent as string | undefined,
          });

          // Welcome email for donation
          const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", userId).single();
          if (profile) {
            await sendTransactionalEmail({
              to: profile.email as string,
              subject: "Donation confirmed",
              html: `<p>Hi ${profile.full_name as string}, your donation of ₹${((session.amount_total ?? 0) / 100).toFixed(0)} has been received. Thank you for your support!</p>`,
            });
          }
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as {
          subscription?: string;
          customer?: string;
          lines?: { data?: { period?: { start?: number; end?: number } }[] };
        };
        if (invoice.subscription) {
          const line = invoice.lines?.data?.[0];
          const periodStart = line?.period?.start ? new Date(line.period.start * 1000).toISOString() : undefined;
          const periodEnd = line?.period?.end ? new Date(line.period.end * 1000).toISOString() : undefined;

          await supabase
            .from("subscriptions")
            .update({
              status: "active",
              latest_invoice_status: "paid",
              ...(periodStart ? { current_period_start: periodStart } : {}),
              ...(periodEnd ? { current_period_end: periodEnd } : {}),
            })
            .eq("stripe_subscription_id", invoice.subscription);

          // Send payment success email
          const { data: sub } = await supabase
            .from("subscriptions")
            .select("user_id, profiles(email, full_name)")
            .eq("stripe_subscription_id", invoice.subscription)
            .single();
          const profile = sub?.profiles as unknown as { email: string; full_name: string } | null;
          if (profile) {
            await sendTransactionalEmail({
              to: profile.email,
              subject: "Payment confirmed — Good Drive Club",
              html: `<p>Hi ${profile.full_name}, your subscription payment was successful. You're all set for the next draw!</p>`,
            });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as { subscription?: string };
        if (invoice.subscription) {
          await supabase
            .from("subscriptions")
            .update({ status: "past_due", latest_invoice_status: "open" })
            .eq("stripe_subscription_id", invoice.subscription);

          const { data: sub } = await supabase
            .from("subscriptions")
            .select("user_id, profiles(email, full_name)")
            .eq("stripe_subscription_id", invoice.subscription)
            .single();
          const profile = sub?.profiles as unknown as { email: string; full_name: string } | null;
          if (profile) {
            await sendTransactionalEmail({
              to: profile.email,
              subject: "Payment failed — action required",
              html: `<p>Hi ${profile.full_name}, we couldn't process your payment. Please update your payment method to keep your draw eligibility.</p>`,
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as { id: string };
        await supabase
          .from("subscriptions")
          .update({ status: "canceled", cancel_at_period_end: false })
          .eq("stripe_subscription_id", sub.id);

        const { data: subRow } = await supabase
          .from("subscriptions")
          .select("user_id, profiles(email, full_name)")
          .eq("stripe_subscription_id", sub.id)
          .single();
        const profile = subRow?.profiles as { email: string; full_name: string } | null;
        if (profile) {
          await sendTransactionalEmail({
            to: profile.email,
            subject: "Subscription cancelled — Good Drive Club",
            html: `<p>Hi ${profile.full_name}, your subscription has been cancelled. We hope to see you back soon!</p>`,
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as {
          id: string;
          status: string;
          cancel_at_period_end: boolean;
          current_period_start: number;
          current_period_end: number;
          items?: { data?: { price?: { id: string } }[] };
        };
        await supabase
          .from("subscriptions")
          .update({
            status: sub.status,
            cancel_at_period_end: sub.cancel_at_period_end,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            stripe_price_id: sub.items?.data?.[0]?.price?.id,
          })
          .eq("stripe_subscription_id", sub.id);
        break;
      }

      default:
        console.info("Stripe webhook — unhandled event type:", event.type);
    }
  } catch (error) {
    console.error("Stripe webhook handler error:", error);
    // Still return 200 to prevent Stripe from retrying non-transient errors
  }

  return NextResponse.json({ received: true, type: event.type });
}
