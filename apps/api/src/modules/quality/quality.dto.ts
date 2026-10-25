import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OosConclusion } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { SignatureDto } from '../signatures/signature.service';

export class CollectSampleDto {
  @ApiPropertyOptional({ description: 'Quantity withdrawn from the lot for testing' }) @IsOptional() @IsNumber() @IsPositive() sampleQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;
}

export class ResultEntryDto {
  @ApiProperty() @IsUUID() specTestId: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() numericValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) textValue?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() passFail?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() instrument?: string;
  @ApiPropertyOptional({ description: 'Required when replacing a previously entered value' }) @IsOptional() @IsString() @MinLength(5) correctionReason?: string;
}

export class EnterResultsDto {
  @ApiProperty({ type: [ResultEntryDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ResultEntryDto) results: ResultEntryDto[];
}

export class ReviewDto {
  @ApiProperty({ enum: ['ACCEPT', 'RETURN'] }) @IsIn(['ACCEPT', 'RETURN']) decision: 'ACCEPT' | 'RETURN';
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
}

export class OosAdvanceDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() ownerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(5) preliminaryFindings?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(5) labInvestigation?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() assignableLabError?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) manufacturingInvestigation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(5) rootCause?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(5) impactAssessment?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(5) capaJustification?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() equipmentId?: string;
}

export class OosApproveDto extends SignatureDto {
  @ApiProperty({ enum: OosConclusion }) @IsEnum(OosConclusion) conclusion: OosConclusion;
}

export class LinkDeviationDto {
  @ApiProperty() @IsUUID() deviationId: string;
}
