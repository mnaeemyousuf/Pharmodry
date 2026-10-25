import { LoggerService } from '@nestjs/common';

/** Structured JSON logs for production (Application Insights / Log Analytics friendly). */
export class JsonLogger implements LoggerService {
  private write(level: string, message: unknown, context?: string, extra?: unknown) {
    const entry = typeof message === 'object' && message !== null ? { ...(message as object) } : { msg: message };
    process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level, context, ...entry, ...(extra ? { extra } : {}) }) + '\n');
  }
  log(message: unknown, context?: string) {
    this.write('info', message, context);
  }
  error(message: unknown, trace?: string, context?: string) {
    this.write('error', message, context, trace);
  }
  warn(message: unknown, context?: string) {
    this.write('warn', message, context);
  }
  debug(message: unknown, context?: string) {
    this.write('debug', message, context);
  }
  verbose(message: unknown, context?: string) {
    this.write('verbose', message, context);
  }
}
