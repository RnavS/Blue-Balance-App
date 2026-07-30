function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. See server/.env.example.`);
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  nodeEnv: optional('NODE_ENV', 'development'),

  databaseUrl: required('DATABASE_URL'),

  /**
   * Must be at least 32 characters. Rotating it invalidates every access token
   * immediately; refresh tokens survive because they are opaque and stored.
   */
  jwtSecret: required('AUTH_JWT_SECRET'),
  accessTokenTtlSeconds: Number(optional('ACCESS_TOKEN_TTL_SECONDS', '3600')),
  refreshTokenTtlDays: Number(optional('REFRESH_TOKEN_TTL_DAYS', '60')),

  /** Comma-separated. Empty means allow all, which is fine for a native-only app. */
  corsOrigins: optional('CORS_ORIGINS')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean),

  openaiApiKey: optional('OPENAI_API_KEY'),
  openaiModel: optional('OPENAI_MODEL', 'gpt-4o-mini'),

  stripeSecretKey: optional('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: optional('STRIPE_WEBHOOK_SECRET'),
  stripeMonthlyPriceId: optional('STRIPE_PREMIUM_MONTHLY_PRICE_ID'),
  stripeAnnualPriceId: optional('STRIPE_PREMIUM_ANNUAL_PRICE_ID'),

  goUpcApiKey: optional('GO_UPC_API_KEY'),

  /** Set to "false" to re-enable the paywall on iOS. See docs/APP_STORE_SUBMISSION.md. */
  iosPremiumFree: optional('IOS_PREMIUM_FREE', 'true'),
} as const;

if (config.jwtSecret.length < 32) {
  throw new Error('AUTH_JWT_SECRET must be at least 32 characters.');
}
