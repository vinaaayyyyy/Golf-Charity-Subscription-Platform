const getSiteUrl = () => {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
};

const env = {
  siteUrl: getSiteUrl(),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  resendApiKey: process.env.RESEND_API_KEY,
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
};

export const stripePriceMap = {
  monthly: {
    10: process.env.STRIPE_PRICE_MONTHLY_10,
    15: process.env.STRIPE_PRICE_MONTHLY_15,
    20: process.env.STRIPE_PRICE_MONTHLY_20,
    25: process.env.STRIPE_PRICE_MONTHLY_25,
    30: process.env.STRIPE_PRICE_MONTHLY_30,
  },
  yearly: {
    10: process.env.STRIPE_PRICE_YEARLY_10,
    15: process.env.STRIPE_PRICE_YEARLY_15,
    20: process.env.STRIPE_PRICE_YEARLY_20,
    25: process.env.STRIPE_PRICE_YEARLY_25,
    30: process.env.STRIPE_PRICE_YEARLY_30,
  },
} as const;

export function isDemoMode() {
  return env.demoMode || !env.supabaseUrl || !env.supabaseAnonKey;
}

export function hasStripe() {
  return Boolean(env.stripeSecretKey);
}

export function hasResend() {
  return Boolean(env.resendApiKey);
}

export { env };
