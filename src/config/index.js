/**
 * BetBingo Config — loads .env and validates all required env vars at startup
 * using Zod. Fail-fast on missing/invalid configuration.
 */

import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';

dotenv.config();

// Fix: if CHAPA vars exist as empty strings in the shell environment
if (!process.env.CHAPA_SECRET_KEY || !process.env.CHAPA_WEBHOOK_SECRET) {
  try {
    const envRaw = dotenv.parse(readFileSync('.env', 'utf8'));
    if (!process.env.CHAPA_SECRET_KEY && envRaw.CHAPA_SECRET_KEY) {
      process.env.CHAPA_SECRET_KEY = envRaw.CHAPA_SECRET_KEY;
    }
    if (!process.env.CHAPA_WEBHOOK_SECRET && envRaw.CHAPA_WEBHOOK_SECRET) {
      process.env.CHAPA_WEBHOOK_SECRET = envRaw.CHAPA_WEBHOOK_SECRET;
    }
  } catch { /* .env file missing */ }
}

import { z } from 'zod';

const envSchema = z.object({
  APP_NAME: z.string().default('BetBingo'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_URL: z.string().default('http://localhost:3000'),

  BOT_TOKEN: z.string().default(''),
  BOT_USERNAME: z.string().default(''),

  DATABASE_URL: z.string().default('postgres://betbingo:betbingo@localhost:5433/betbingo'),
  PGSSL: z.string().transform((v) => ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase())).default('false'),

  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters'),
  JWT_EXPIRY: z.string().default('24h'),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional().default(''),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().optional().default(''),

  CHAPA_SECRET_KEY: z.string().default(''),
  CHAPA_WEBHOOK_SECRET: z.string().default(''),

  CURRENCY: z.string().default('ETB'),

  TELEGRAM_MODE: z.enum(['polling', 'webhook']).default('polling'),
  TELEGRAM_WEBHOOK_URL: z.string().default(''),
  TELEGRAM_WEBHOOK_PATH: z.string().default('/webhook/telegram'),

  CORS_ORIGINS: z.string().default('*'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('pretty'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  console.error('❌ Invalid environment configuration:\n' + issues);
  console.error('\nCopy .env.example to .env and fill in the required values.');
  process.exit(1);
}

const env = parsed.data;

export const config = {
  appName: env.APP_NAME,
  env: env.NODE_ENV,
  port: env.PORT,
  publicUrl: env.PUBLIC_URL,

  botToken: env.BOT_TOKEN,
  botUsername: env.BOT_USERNAME,

  databaseUrl: env.DATABASE_URL,
  pgSsl: env.PGSSL ? { rejectUnauthorized: false } : false,

  jwtSecret: env.JWT_SECRET,
  jwtExpiry: env.JWT_EXPIRY,
  adminBootstrap: {
    email: env.ADMIN_BOOTSTRAP_EMAIL,
    password: env.ADMIN_BOOTSTRAP_PASSWORD,
  },

  chapa: {
    secretKey: env.CHAPA_SECRET_KEY,
    webhookSecret: env.CHAPA_WEBHOOK_SECRET,
  },

  business: {
    currency: env.CURRENCY,
  },

  telegram: {
    mode: env.TELEGRAM_MODE,
    webhookUrl: env.TELEGRAM_WEBHOOK_URL,
    webhookPath: env.TELEGRAM_WEBHOOK_PATH,
  },

  security: {
    corsOrigins: env.CORS_ORIGINS,
    rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },

  logging: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
  },
};

export function assertBotConfig() {
  if (!config.botToken) {
    throw new Error(
      'BOT_TOKEN is not set. Copy .env.example to .env and set it from @BotFather.'
    );
  }
}
