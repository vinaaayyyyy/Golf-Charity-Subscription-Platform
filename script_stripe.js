const fs = require("fs");
const Stripe = require("stripe");

const envVars = fs.readFileSync(".env.local", "utf8");
const match = envVars.match(/STRIPE_SECRET_KEY="?([^"\n]+)"?/);
const stripeKey = match ? match[1].trim() : null;

if (!stripeKey) {
  console.error("Missing STRIPE_SECRET_KEY in .env.local!");
  process.exit(1);
}

const stripe = new Stripe(stripeKey);

async function main() {
  console.log("Creating Stripe Product...");
  const product = await stripe.products.create({
    name: "Golf Charity Subscription",
    description: "Multi-tier rolling scorecard subscription.",
  });

  console.log(`Product created: ${product.id}`);

  const tiers = [10, 15, 20, 25, 30];
  const results = [];

  // Monthly (base = $10.00)
  for (const tier of tiers) {
    const amount = 1000 + (1000 * (tier / 100));
    console.log(`Creating Monthly ${tier}% tier ($${amount / 100})...`);
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amount,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { cadence: "monthly", tier: String(tier) },
    });
    results.push(`STRIPE_PRICE_MONTHLY_${tier}=${price.id}`);
  }

  // Yearly (base = $100.00)
  for (const tier of tiers) {
    const amount = 10000 + (10000 * (tier / 100));
    console.log(`Creating Yearly ${tier}% tier ($${amount / 100})...`);
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amount,
      currency: "usd",
      recurring: { interval: "year" },
      metadata: { cadence: "yearly", tier: String(tier) },
    });
    results.push(`STRIPE_PRICE_YEARLY_${tier}=${price.id}`);
  }

  const envAddition = "\n" + results.join("\n") + "\n";
  fs.appendFileSync(".env.local", envAddition);
  console.log("\nSuccess! Added the 10 Stripe Price IDs to your .env.local file.");
}

main().catch(console.error);
