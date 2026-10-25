import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ClsService } from 'nestjs-cls';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { RequestStore } from '../../common/context';
import type { AuthPrincipal } from '../../common/auth-user';
import { UnauthorizedError } from '../../common/errors';
import { PrismaService, Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';
import { serialize } from '../../common/http';

/** Payload every signing endpoint accepts. Password re-entry is mandatory (re-authentication). */
export class SignatureDto {
  @ApiProperty({ description: 'Current password (re-authentication)' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ description: 'Reason / comment recorded with the signature' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class SignedReasonDto extends SignatureDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  declare reason: string;
}

export interface SignTarget {
  entityType: string;
  entityId: string;
  entityLabel: string;
  /** e.g. BATCH_QA_RELEASE */
  action: string;
  /** Human statement of what the signature means (21 CFR 11.50). */
  meaning: string;
  /** Snapshot of the record being signed; hashed and stored with the signature. */
  record: unknown;
}

@Injectable()
export class SignatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    private readonly cls: ClsService<RequestStore>,
  ) {}

  /**
   * Re-authenticates the signer, stores the signature separately from the audit trail,
   * and links both. Must be called inside the business transaction.
   */
  async sign(tx: Tx, user: AuthPrincipal, dto: SignatureDto, target: SignTarget) {
    const account = await tx.user.findFirst({ where: { id: user.id, tenantId: user.tenantId, status: 'ACTIVE' } });
    const ok = account ? await this.passwords.verify(dto.password, account.passwordHash) : false;
    if (!ok) {
      // Recorded outside the (soon rolled back) business transaction.
      await this.audit.recordStandalone({
        entityType: target.entityType,
        entityId: target.entityId,
        entityLabel: target.entityLabel,
        action: 'SIGN',
        reason: `FAILED signature attempt for ${target.action}: invalid credentials`,
      });
      throw new UnauthorizedError('Electronic signature failed: password is incorrect', 'SIGNATURE_INVALID');
    }
    const recordHash = createHash('sha256').update(JSON.stringify(serialize(target.record))).digest('hex');
    const signature = await tx.electronicSignature.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        signerName: account!.fullName,
        signerEmail: account!.email,
        entityType: target.entityType,
        entityId: target.entityId,
        action: target.action,
        meaning: target.meaning,
        reason: dto.reason ?? null,
        recordHash,
        ip: this.cls.isActive() ? (this.cls.get('ip') ?? null) : null,
      },
    });
    await this.audit.record(tx, {
      entityType: target.entityType,
      entityId: target.entityId,
      entityLabel: target.entityLabel,
      action: 'SIGN',
      next: { action: target.action, meaning: target.meaning, signatureId: signature.id, recordHash },
      reason: dto.reason ?? null,
      signatureId: signature.id,
    });
    return signature;
  }

  forEntity(entityType: string, entityId: string) {
    return this.prisma.db.electronicSignature.findMany({ where: { entityType, entityId }, orderBy: { signedAt: 'asc' } });
  }
}
