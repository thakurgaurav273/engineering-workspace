import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { TEMPLATED_TYPES, TemplatedType } from '../template-variables';
import { MAX_TEMPLATE_LENGTH } from '../template-engine';

const toBool = ({ value }: { value: unknown }) => value === true || value === 'true';

export class ListTemplatesDto {
  @ApiPropertyOptional({ enum: TEMPLATED_TYPES })
  @IsOptional()
  @IsIn(TEMPLATED_TYPES)
  documentType?: TemplatedType;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  includeArchived?: boolean;

  @ApiPropertyOptional({ description: 'List platform starters instead of the org\'s templates' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  platform?: boolean;
}

export class CreateTemplateDto {
  @ApiProperty({ enum: TEMPLATED_TYPES })
  @IsIn(TEMPLATED_TYPES)
  documentType!: TemplatedType;

  @ApiProperty({ example: 'GST invoice with QR' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'gst_invoice_qr', description: 'Unique within the org; derived from the name when omitted' })
  @IsOptional()
  @Matches(/^[a-z][a-z0-9_]{2,63}$/, { message: 'key must be 3-64 lowercase letters, digits or _' })
  key?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    description: '"blank", "builtin:<key>" (a built-in starter) or "template:<id>" (copy a template or platform starter)',
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: 'Create a platform starter (super admins only)' })
  @IsOptional()
  @IsBoolean()
  platform?: boolean;

  @ApiPropertyOptional({
    description: 'Publish v1 straight away so documents can use it (default: true unless starting blank)',
  })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;

  @ApiPropertyOptional({ description: 'Make it the org default for its document type once published' })
  @IsOptional()
  @IsBoolean()
  makeDefault?: boolean;
}

export class UpdateTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Offer letters only: the wording new offers start from ("" = built-in)' })
  @IsOptional()
  @IsString()
  @MaxLength(60000)
  defaultBody?: string;
}

export class SaveDraftDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  expectedRevision!: number;

  @ApiProperty()
  @IsString()
  @MaxLength(MAX_TEMPLATE_LENGTH)
  html!: string;
}

export class RevisionDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  expectedRevision!: number;

  @ApiPropertyOptional({ description: 'Release notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class RollbackDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class PreviewDto {
  @ApiProperty({ enum: TEMPLATED_TYPES })
  @IsIn(TEMPLATED_TYPES)
  documentType!: TemplatedType;

  @ApiProperty()
  @IsString()
  @MaxLength(MAX_TEMPLATE_LENGTH)
  html!: string;

  @ApiPropertyOptional({ description: 'Render with this real document instead of sample data' })
  @IsOptional()
  @IsString()
  documentId?: string;

  @ApiPropertyOptional({ enum: ['html', 'pdf'], default: 'html' })
  @IsOptional()
  @IsIn(['html', 'pdf'])
  format?: 'html' | 'pdf';
}

export class VersionQueryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}
