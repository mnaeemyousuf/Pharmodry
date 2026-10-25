/** Standard API envelope shared by the API and web clients. */
export interface ApiResponse<T> {
  data: T;
  meta?: PageMeta & Record<string, unknown>;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
    correlationId?: string;
  };
}

export interface Citation {
  type: string;
  id: string;
  label: string;
  href: string;
}

export interface AuthUser {
  id: string;
  tenantId: string;
  tenantName: string;
  email: string;
  fullName: string;
  title?: string | null;
  permissions: string[];
  /** permission code → site ids; `"*"` means all sites. */
  sitePermissions: Record<string, string[]>;
  sites: { id: string; code: string; name: string }[];
}

export interface BlockingReason {
  code: string;
  message: string;
  href?: string;
}
