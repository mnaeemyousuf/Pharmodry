import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import type { PageMeta } from '@pharmodry/types';

export class ListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 25, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize = 25;

  @ApiPropertyOptional({ description: 'field:asc|desc', example: 'createdAt:desc' })
  @IsOptional()
  @Matches(/^[a-zA-Z_.]+:(asc|desc)$/)
  sort?: string;

  @ApiPropertyOptional({ description: 'Free-text search' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Status filter (comma separated)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;
}

export interface Paged<T> {
  data: T[];
  meta: PageMeta;
}

export function pageArgs(q: ListQueryDto) {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}

/** Converts `field:dir` into a Prisma orderBy, only for whitelisted fields. */
export function orderBy(q: ListQueryDto, allowed: string[], fallback: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' }) {
  if (!q.sort) return fallback;
  const [field, dir] = q.sort.split(':') as [string, 'asc' | 'desc'];
  if (!allowed.includes(field)) return fallback;
  return { [field]: dir };
}

export function statusFilter<T extends string>(q: ListQueryDto): { in: T[] } | undefined {
  if (!q.status) return undefined;
  return { in: q.status.split(',').map((s) => s.trim()).filter(Boolean) as T[] };
}

export function toPage<T>(rows: T[], total: number, q: ListQueryDto): Paged<T> {
  return { data: rows, meta: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) } };
}

/** Case-insensitive contains across several string columns. */
export function textSearch(q: string | undefined, fields: string[]) {
  if (!q || !q.trim()) return undefined;
  const term = q.trim();
  return fields.map((f) => ({ [f]: { contains: term, mode: 'insensitive' as const } }));
}

/** List query with the common optional filters used across modules (all whitelisted). */
export class FilterQueryDto extends ListQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() materialId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() productId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() batchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lotId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() supplierId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() warehouseId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() itemType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() stage?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() severity?: string;
  @ApiPropertyOptional({ description: 'ISO date' }) @IsOptional() @IsString() from?: string;
  @ApiPropertyOptional({ description: 'ISO date' }) @IsOptional() @IsString() to?: string;
  @ApiPropertyOptional({ description: 'e.g. overdue, expiring30, awaitingQa' }) @IsOptional() @IsString() view?: string;
}
