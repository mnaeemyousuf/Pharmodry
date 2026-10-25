import { ClsStore } from 'nestjs-cls';

/** Per-request context propagated via AsyncLocalStorage. */
export interface RequestStore extends ClsStore {
  tenantId?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  ip?: string;
  userAgent?: string;
  correlationId?: string;
}
