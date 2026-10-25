import { HttpException, HttpStatus } from '@nestjs/common';
import type { BlockingReason } from '@pharmodry/types';

/** Base class for domain errors with a stable machine-readable code. */
export class AppError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super('NOT_FOUND', `${entity}${id ? ` ${id}` : ''} not found`, HttpStatus.NOT_FOUND);
  }
}

/** Invalid state transition or concurrent modification. */
export class ConflictError extends AppError {
  constructor(message: string, details?: unknown, code = 'CONFLICT') {
    super(code, message, HttpStatus.CONFLICT, details);
  }
}

/** A GMP/business rule prevents the action. `details` lists blocking reasons. */
export class RuleViolationError extends AppError {
  constructor(message: string, reasons?: BlockingReason[], code = 'RULE_VIOLATION') {
    super(code, message, HttpStatus.UNPROCESSABLE_ENTITY, reasons ? { reasons } : undefined);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action', details?: unknown) {
    super('FORBIDDEN', message, HttpStatus.FORBIDDEN, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = 'UNAUTHORIZED') {
    super(code, message, HttpStatus.UNAUTHORIZED);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, HttpStatus.BAD_REQUEST, details);
  }
}

export function assertTransition<S extends string>(table: Record<S, S[]>, entity: string, from: S, to: S) {
  if (!(table[from] ?? []).includes(to)) {
    throw new ConflictError(`${entity} cannot move from ${from} to ${to}`, { from, to }, 'INVALID_TRANSITION');
  }
}
