import { BadRequestException, Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { EmploymentType } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../kernel/authorization/require-permission.decorator';
import { OfferLetterTemplatesService } from './offer-letter-templates.service';
import { EMPLOYMENT_TYPES } from './offer-letter-clauses';

type Principal = { orgId?: string };

class UpsertTemplateDto {
  @IsString() @MaxLength(60000) content!: string;
}

function parseType(value: string): EmploymentType {
  if (!(EMPLOYMENT_TYPES as string[]).includes(value)) {
    throw new BadRequestException(`Unknown employment type "${value}"`);
  }
  return value as EmploymentType;
}

@UseGuards(JwtAuthGuard)
@Controller('business/offer-letter-templates')
export class OfferLetterTemplatesController {
  constructor(private readonly templates: OfferLetterTemplatesService) {}

  @Get()
  @RequirePermission('business-operations:offer-letter:read')
  list(@CurrentUser() user: Principal) {
    return this.templates.list(user.orgId!);
  }

  @Put(':type')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:offer-letter:write')
  upsert(@CurrentUser() user: Principal, @Param('type') type: string, @Body() dto: UpsertTemplateDto) {
    return this.templates.upsert(user.orgId!, parseType(type), dto.content);
  }

  @Delete(':type')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:offer-letter:write')
  reset(@CurrentUser() user: Principal, @Param('type') type: string) {
    return this.templates.reset(user.orgId!, parseType(type));
  }
}
