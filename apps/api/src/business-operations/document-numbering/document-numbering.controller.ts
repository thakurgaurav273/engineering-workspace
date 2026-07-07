import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BusinessDocumentType } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../kernel/authorization/require-permission.decorator';
import { DocumentNumberingService } from './document-numbering.service';
import { UpdateDocumentNumberingDto } from './dto/update-document-numbering.dto';

type Principal = { orgId?: string };

/**
 * Per-organization document numbering configuration. Read: any member. Write + reserve:
 * OWNER/ADMIN. Future document modules call DocumentNumberingService.next() directly.
 */
@UseGuards(JwtAuthGuard)
@Controller('business/document-numbering')
export class DocumentNumberingController {
  constructor(private readonly numbering: DocumentNumberingService) {}

  @Get()
  @RequirePermission('business-operations:document-numbering:read')
  list(@CurrentUser() user: Principal) {
    return this.numbering.list(user.orgId!);
  }

  @Patch(':documentType')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:document-numbering:write')
  update(
    @CurrentUser() user: Principal,
    @Param('documentType', new ParseEnumPipe(BusinessDocumentType)) type: BusinessDocumentType,
    @Body() dto: UpdateDocumentNumberingDto,
  ) {
    return this.numbering.upsert(user.orgId!, type, dto);
  }

  @Post(':documentType/preview')
  @RequirePermission('business-operations:document-numbering:read')
  preview(
    @CurrentUser() user: Principal,
    @Param('documentType', new ParseEnumPipe(BusinessDocumentType)) type: BusinessDocumentType,
    @Body() draft: UpdateDocumentNumberingDto,
  ) {
    return this.numbering.preview(user.orgId!, type, draft);
  }

  @Post(':documentType/next')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission('business-operations:document-numbering:write')
  next(
    @CurrentUser() user: Principal,
    @Param('documentType', new ParseEnumPipe(BusinessDocumentType)) type: BusinessDocumentType,
  ) {
    return this.numbering.next(user.orgId!, type);
  }
}
