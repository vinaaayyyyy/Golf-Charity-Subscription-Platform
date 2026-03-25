import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getCurrentViewer } from "@/lib/session";
import { getStripeServer } from "@/lib/stripe";
import { recordIndependentDonation } from "@/lib/platform";

export async function POST(request: Request) {
  const viewer = await getCurrentViewer();
  if (!viewer) {
    return NextResponse.redirect(new URL("/sign-in", env.siteUrl));
  }

  try {
    const formData = await request.formData();
    const charityId = String(formData.get("charityId") ?? viewer.profile.selectedCharityId);
    let amountStr = formData.get("amount");
    if (!amountStr) amountStr = "2500";
    const amountCents = Number(amountStr) * 100;

    const stripe = getStripeServer();
    if (stripe) {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: viewer.profile.email,
        success_url: `${env.siteUrl}/dashboard?donation=success`,
        cancel_url: `${env.siteUrl}/dashboard?donation=cancelled`,
        line_items: [
          {
            price_data: {
              currency: "inr",
              product_data: {
                name: "Independent charity donation",
              },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          userId: viewer.profile.id,
          charityId,
          donationAmount: String(amountCents),
        },
      });

      if (session.url) {
        return NextResponse.redirect(session.url, 303);
      }
    }

    // Fallback if Stripe is not available
    await recordIndependentDonation(viewer.profile.id, charityId, amountCents);
    return NextResponse.redirect(new URL("/dashboard?donation=demo-success", env.siteUrl), 303);

  } catch (err) {
    console.error("Donation checkout error:", err);
    return NextResponse.redirect(new URL("/dashboard?error=donation-failed", env.siteUrl), 303);
  }
}
