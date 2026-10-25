import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDefined, IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsPositive, IsString, IsUUID, Min, MinLength, ValidateNested } from 'class-validator';
import { SignatureDto } from '../signatures/signature.service';

export class PlanLineDto {
  @ApiProperty() @IsUUID() productId: string;
  @ApiProperty() @IsNumber() @IsPositive() plannedQuantity: number;
  @ApiProperty() @IsInt() @Min(1) plannedBatches: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) demandQuantity?: number;
}

export class CreatePlanDto {
  @ApiProperty() @IsUUID() siteId: string;
  @ApiProperty() @IsString() @MinLength(3) name: string;
  @ApiProperty() @IsDateString() periodStart: string;
  @ApiProperty() @IsDateString() periodEnd: string;
  @ApiProperty({ type: [PlanLineDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PlanLineDto) lines: PlanLineDto[];
}

export class CreateBatchDto {
  @ApiProperty() @IsUUID() siteId: string;
  @ApiProperty() @IsUUID() productId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() planLineId?: string;
  @ApiPropertyOptional({ description: 'Defaults to the product standard batch size' }) @IsOptional() @IsNumber() @IsPositive() plannedQuantity?: number;
  @ApiProperty() @IsDateString() plannedStart: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() plannedEnd?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productionLineId?: string;
}

export class StartStepDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() equipmentId?: string;
  @ApiPropertyOptional({ description: 'Required to use equipment with expired calibration under WARN policy' }) @IsOptional() @IsString() @MinLength(5) calibrationOverrideReason?: string;
}

export class ConsumptionDto {
  @ApiProperty() @IsUUID() lotId: string;
  @ApiProperty() @IsNumber() @Min(0) actualQuantity: number;
}

export class CompleteStepDto extends SignatureDto {
  @ApiPropertyOptional({ description: 'Parameter code → value' }) @IsOptional() @IsObject() readings?: Record<string, number | string>;
  @ApiPropertyOptional({ description: 'IPC code → value' }) @IsOptional() @IsObject() ipcResults?: Record<string, number | string>;
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;
  @ApiPropertyOptional({ type: [ConsumptionDto] }) @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ConsumptionDto) consumptions?: ConsumptionDto[];
  @ApiPropertyOptional() @IsOptional() @IsNumber() @IsPositive() outputQuantity?: number;
}

export class CorrectStepDto {
  @ApiProperty({ description: 'readings.<code> | ipcResults.<code> | remarks | outputQuantity' }) @IsString() field: string;
  @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'number' }] }) @IsDefined() newValue: string | number;
  @ApiProperty() @IsString() @MinLength(5) reason: string;
}

export class CompleteBatchDto {
  @ApiPropertyOptional({ description: 'Required when yield is outside tolerance and no deviation is linked' }) @IsOptional() @IsString() @MinLength(10) yieldJustification?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() yieldDeviationId?: string;
}

export class QaDecisionDto extends SignatureDto {
  @ApiProperty({ enum: ['RELEASE', 'REJECT'] }) @IsIn(['RELEASE', 'REJECT']) decision: 'RELEASE' | 'REJECT';
}

export class ReasonDto {
  @ApiProperty() @IsString() @MinLength(5) reason: string;
}

export class AvailabilityQueryDto {
  @ApiProperty() @IsUUID() productId: string;
  @ApiProperty() @IsUUID() siteId: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() quantity?: number;
}
