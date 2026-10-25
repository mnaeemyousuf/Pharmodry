import {
  ArgumentsHost,
  CallHandler,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { Observable, map } from 'rxjs';
import type { RequestStore } from './context';

/** Recursively converts Prisma Decimal → number and BigInt → string for JSON. */
export function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Prisma.Decimal.isDecimal(value)) return (value as Prisma.Decimal).toNumber();
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    if (Buffer.isBuffer(value)) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === 'passwordHash' || k === 'tokenHash') continue;
      out[k] = serialize(v);
    }
    return out;
  }
  return value;
}

/** Wraps every response as `{ data, meta? }`. Handlers returning `{ data, meta }` are passed through. */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((body) => {
        const res = ctx.switchToHttp().getResponse<Response>();
        if (res.getHeader('content-type')?.toString().startsWith('text/csv')) return body;
        const s = serialize(body);
        if (s && typeof s === 'object' && !Array.isArray(s) && 'data' in (s as object) && Object.keys(s as object).every((k) => k === 'data' || k === 'meta')) {
          return s;
        }
        return { data: s ?? null };
      }),
    );
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');
  constructor(private readonly cls: ClsService<RequestStore>) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const correlationId = this.cls.isActive() ? this.cls.getId() : undefined;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as string | { code?: string; message?: string | string[]; details?: unknown; error?: string };
      if (typeof body === 'string') {
        message = body;
      } else {
        code = body.code ?? (status === 400 ? 'VALIDATION_ERROR' : status === 429 ? 'RATE_LIMITED' : HttpStatus[status] ?? 'ERROR');
        if (Array.isArray(body.message)) {
          message = 'Validation failed';
          details = body.message;
        } else {
          message = body.message ?? message;
          details = body.details;
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'DUPLICATE';
        message = `A record with this ${(exception.meta?.target as string[] | undefined)?.join(', ') ?? 'value'} already exists`;
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'NOT_FOUND';
        message = 'Record not found';
      } else if (exception.code === 'P2034') {
        status = HttpStatus.CONFLICT;
        code = 'CONCURRENT_MODIFICATION';
        message = 'The record was changed by someone else. Reload and try again.';
      }
    }

    if (status >= 500) {
      this.logger.error({ msg: 'Unhandled error', correlationId, path: req.url, err: exception instanceof Error ? exception.stack : String(exception) });
    }
    res.status(status).json({ error: { code, message, details, correlationId } });
  }
}
