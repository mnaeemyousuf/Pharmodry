/**
 * Environment configuration. Secrets come only from environment variables (Key Vault in Azure);
 * nothing here is ever sent to the browser.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  jwtAccessSecret: string;
  jwtAccessTtlSeconds: number;
  refreshTtlDays: number;
  corsOrigins: string[];
  cookieSecure: boolean;
  redisUrl?: string;
  mistralApiKey?: string;
  mistralModel: string;
  mistralBaseUrl: string;
  storageDriver: 'local';
  storageLocalDir: string;
  maxUploadBytes: number;
  scansIntervalMinutes: number;
  disableScheduler: boolean;
}

function required(name: string, fallbackForDev?: string): string {
  const v = process.env[name];
  if (v && v.length > 0) return v;
  if (fallbackForDev !== undefined && process.env.NODE_ENV !== 'production') return fallbackForDev;
  throw new Error(`Missing required environment variable ${name}`);
}

let cached: AppConfig | undefined;

export function loadConfig(): AppConfig {
  if (cached) return cached;
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const jwtAccessSecret = required('JWT_ACCESS_SECRET', 'dev-only-insecure-secret-change-me-0123456789');
  if (nodeEnv === 'production' && jwtAccessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be at least 32 characters in production');
  }
  cached = {
    nodeEnv,
    port: Number(process.env.PORT ?? 4100),
    databaseUrl: required('DATABASE_URL'),
    jwtAccessSecret,
    jwtAccessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),
    refreshTtlDays: Number(process.env.REFRESH_TTL_DAYS ?? 7),
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map((s) => s.trim()).filter(Boolean),
    cookieSecure: (process.env.COOKIE_SECURE ?? (nodeEnv === 'production' ? 'true' : 'false')) === 'true',
    redisUrl: process.env.REDIS_URL || undefined,
    mistralApiKey: process.env.MISTRAL_API_KEY || undefined,
    mistralModel: process.env.MISTRAL_MODEL ?? 'mistral-small-latest',
    mistralBaseUrl: process.env.MISTRAL_BASE_URL ?? 'https://api.mistral.ai/v1',
    storageDriver: 'local',
    storageLocalDir: process.env.STORAGE_LOCAL_DIR ?? 'storage',
    maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024),
    scansIntervalMinutes: Number(process.env.SCANS_INTERVAL_MINUTES ?? 60),
    disableScheduler: process.env.DISABLE_SCHEDULER === 'true',
  };
  return cached;
}

export function resetConfigCache() {
  cached = undefined;
}
