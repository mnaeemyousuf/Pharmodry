import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min, MinLength, ValidateNested } from 'class-validator';
import { SignatureDto } from '../signatures/signature.service';

export class GrnLineDto {
  @ApiProperty() @IsUUID() materialId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() poLineId?: string;
  @ApiProperty() @IsString() @MinLength(1) supplierBatch: string;
  @ApiProperty() @IsNumber() @IsPositive() quantity: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) containers?: number;
  @ApiProperty() @IsDateString() mfgDate: string;
  @ApiProperty() @IsDateString() expiryDate: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() retestDate?: string;
  @ApiProperty() @IsUUID() warehouseId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() binId?: string;
}

export class CreateGrnDto {
  @ApiProperty() @IsUUID() siteId: string;
  @ApiProperty() @IsUUID() supplierId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() purchaseOrderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() deliveryNote?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;
  @ApiProperty({ type: [GrnLineDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => GrnLineDto) lines: GrnLineDto[];
}

export class TransferDto {
  @ApiProperty() @IsUUID() toWarehouseId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() toBinId?: string;
  @ApiProperty() @IsNumber() @IsPositive() quantity: number;
  @ApiProperty() @IsString() @MinLength(3) reason: string;
}

export class AdjustDto {
  @ApiProperty({ description: 'Signed quantity change' }) @IsNumber() quantity: number;
  @ApiProperty() @IsString() @MinLength(5) reason: string;
}

export class DispositionDto extends SignatureDto {
  @ApiProperty({ enum: ['RELEASE', 'REJECT'] }) @IsIn(['RELEASE', 'REJECT']) decision: 'RELEASE' | 'REJECT';
}

export class BlockDto {
  @ApiProperty({ enum: ['BLOCK', 'UNBLOCK'] }) @IsIn(['BLOCK', 'UNBLOCK']) action: 'BLOCK' | 'UNBLOCK';
  @ApiProperty() @IsString() @MinLength(5) reason: string;
}
