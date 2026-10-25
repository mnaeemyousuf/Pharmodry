import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MasterStatus, MaterialType, QcStage, SpecOperator, SpecResultType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ProductDto {
  @ApiProperty() @IsString() @Matches(/^[A-Z0-9-]{2,30}$/) code: string;
  @ApiProperty() @IsString() genericName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() brandName?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() dosageFormId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiProperty() @IsString() strength: string;
  @ApiPropertyOptional() @IsOptional() @IsString() packSize?: string;
  @ApiProperty() @IsInt() @Min(1) shelfLifeMonths: number;
  @ApiPropertyOptional() @IsOptional() @IsString() storageConditions?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() registrationNumber?: string;
  @ApiPropertyOptional({ description: 'GS1 GTIN-8/12/13/14 (check digit validated)' }) @IsOptional() @Matches(/^\d{8,14}$/) gtin?: string;
  @ApiProperty() @IsString() @Matches(/^[A-Z0-9]{2,8}$/) batchPrefix: string;
  @ApiProperty() @IsUUID() uomId: string;
  @ApiProperty() @IsNumber() @IsPositive() standardBatchSize: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) unitPrice?: number;
}

export class UpdateProductDto {
  @ApiPropertyOptional() @IsOptional() @IsString() genericName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() brandName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() strength?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() packSize?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) shelfLifeMonths?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() storageConditions?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() registrationNumber?: string;
  @ApiPropertyOptional({ description: 'GS1 GTIN-8/12/13/14 (check digit validated)' }) @IsOptional() @Matches(/^\d{8,14}$/) gtin?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @IsPositive() standardBatchSize?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) unitPrice?: number;
  @ApiPropertyOptional({ enum: MasterStatus }) @IsOptional() @IsEnum(MasterStatus) status?: MasterStatus;
  @ApiProperty({ description: 'Reason for change (regulated master data)' }) @IsString() @MinLength(5) reason: string;
}

export class MaterialDto {
  @ApiProperty() @IsString() @Matches(/^[A-Z0-9-]{2,30}$/) code: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ enum: MaterialType }) @IsEnum(MaterialType) type: MaterialType;
  @ApiProperty() @IsUUID() uomId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() specificationRef?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() storageRequirement?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) retestPeriodMonths?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) safetyStock?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) leadTimeDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^[A-Z]{1,4}$/) lotPrefix?: string;
}

export class UpdateMaterialDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() specificationRef?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() storageRequirement?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) retestPeriodMonths?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) safetyStock?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) leadTimeDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @ApiPropertyOptional({ enum: MasterStatus }) @IsOptional() @IsEnum(MasterStatus) status?: MasterStatus;
  @ApiProperty() @IsString() @MinLength(5) reason: string;
}

export class BomLineDto {
  @ApiProperty() @IsUUID() materialId: string;
  @ApiProperty() @IsNumber() @IsPositive() quantity: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) tolerancePct?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isCritical?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() stepCode?: string;
}

export class BomDto {
  @ApiProperty() @IsNumber() @IsPositive() batchSize: number;
  @ApiProperty({ type: [BomLineDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => BomLineDto) lines: BomLineDto[];
  @ApiProperty() @IsString() @MinLength(5) reason: string;
}

export class ParamDefDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() label: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() min?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() max?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() required?: boolean;
}

export class RoutingStepDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() instructions: string;
  @ApiPropertyOptional() @IsOptional() @IsString() equipmentType?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() expectedDurationMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresVerification?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() consumesMaterials?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() recordsOutput?: boolean;
  @ApiPropertyOptional({ type: [ParamDefDto] }) @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ParamDefDto) parameters?: ParamDefDto[];
  @ApiPropertyOptional({ type: [ParamDefDto] }) @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ParamDefDto) ipcChecks?: ParamDefDto[];
}

export class RoutingDto {
  @ApiProperty({ type: [RoutingStepDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => RoutingStepDto) steps: RoutingStepDto[];
  @ApiProperty() @IsString() @MinLength(5) reason: string;
}

export class EquipmentDto {
  @ApiProperty() @IsUUID() siteId: string;
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() description: string;
  @ApiProperty() @IsString() type: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() manufacturer?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() model?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() serialNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) calibrationFrequencyDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() nextCalibrationDue?: string;
}

export class CalibrationDto {
  @ApiProperty() @IsDateString() performedAt: string;
  @ApiProperty() @IsString() result: string;
  @ApiPropertyOptional() @IsOptional() @IsString() certificateNo?: string;
  @ApiPropertyOptional({ description: 'Defaults to performedAt + calibration frequency' }) @IsOptional() @IsDateString() nextDue?: string;
}

export class SpecTestDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() testMethodId?: string;
  @ApiProperty({ enum: SpecResultType }) @IsEnum(SpecResultType) resultType: SpecResultType;
  @ApiProperty({ enum: SpecOperator }) @IsEnum(SpecOperator) operator: SpecOperator;
  @ApiPropertyOptional() @IsOptional() @IsNumber() minValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() expectedText?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isMandatory?: boolean;
}

export class SpecificationDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ enum: QcStage }) @IsEnum(QcStage) stage: QcStage;
  @ApiPropertyOptional() @IsOptional() @IsUUID() materialId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string;
  @ApiProperty({ type: [SpecTestDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SpecTestDto) tests: SpecTestDto[];
  @ApiProperty() @IsString() @MinLength(5) reason: string;
}

export class TestMethodDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() technique?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
}
