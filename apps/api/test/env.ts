/* Runs in every e2e worker before modules load. */
import { readState } from './global-setup';

process.env.DATABASE_URL = readState().url;
process.env.DISABLE_SCHEDULER = 'true';
process.env.LOGIN_RATE_LIMIT_PER_MINUTE = '1000';
process.env.RATE_LIMIT_PER_MINUTE = '100000';
process.env.NODE_ENV = 'test';
delete process.env.MISTRAL_API_KEY;
