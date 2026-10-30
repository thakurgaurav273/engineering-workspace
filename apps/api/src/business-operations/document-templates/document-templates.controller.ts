import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../kernel/authorization/require-permission.decorator';
import { Caller, DocumentTemplatesService } from './document-templates.service';
import {
  CreateTemplateDto,
  ListTemplatesDto,
  PreviewDto,
  RevisionDto,
  RollbackDto,
  SaveDraftDto,
  UpdateTemplateDto,
  VersionQueryDto,
} from './dto/document-template.dto';
import { TemplatedType } from './template-variables';

const READ = 'business-operations:document-template:read';
const WRITE = 'business-operations:document-template:write';

function sendPdf(res: Response, pdf: Buffer, fileName: string) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
  res.send(pdf);
}

// Static routes (catalog, starters, preview…) are declared before `:id` so they aren't
// captured as ids. Writes need OWNER/ADMIN; platform starters additionally need super admin
// (checked in the service).
@ApiTags('business-document-templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('business/document-templates')
export class DocumentTemplatesController {
  constructor(private readonly templates: DocumentTemplatesService) {}

  @Get('catalog')
  @RequirePermission(READ)
  @ApiOperation({ summary: 'Variables, formatters, starters and limits for the editor' })
  catalog() {
    return this.templates.catalog();
  }

  @Get('starters')
  @RequirePermission(READ)
  starters(@Query('documentType') documentType?: TemplatedType) {
    return this.templates.starters(documentType);
  }

  @Get('choices')
  @RequirePermission(READ)
  @ApiOperation({ summary: 'Published templates selectable on a document of this type' })
  choices(@CurrentUser() user: Caller, @Query('documentType') documentType: TemplatedType) {
    return this.templates.choices(user, documentType);
  }

  @Post('validate')
  @RequirePermission(READ)
  validate(@CurrentUser() user: Caller, @Body() dto: PreviewDto) {
    return this.templates.validate(user, dto);
  }

  @Post('preview')
  @RequirePermission(READ)
  @ApiOperation({ summary: 'Render unsaved HTML with sample data or a real document (html or pdf)' })
  async preview(@CurrentUser() user: Caller, @Body() dto: PreviewDto, @Res() res: Response) {
    const result = await this.templates.preview(user, dto);
    if ('pdf' in result) return sendPdf(res, result.pdf, 'preview.pdf');
    res.json({ success: true, message: 'OK', data: result });
  }

  @Get()
  @RequirePermission(READ)
  list(@CurrentUser() user: Caller, @Query() query: ListTemplatesDto) {
    return this.templates.list(user, query);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission(WRITE)
  create(@CurrentUser() user: Caller, @Body() dto: CreateTemplateDto) {
    return this.templates.create(user, dto);
  }

  @Get(':id')
  @RequirePermission(READ)
  get(@CurrentUser() user: Caller, @Param('id') id: string) {
    return this.templates.get(id, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission(WRITE)
  update(@CurrentUser() user: Caller, @Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templates.updateDetails(id, user, dto);
  }

  @Post(':id/draft')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission(WRITE)
  saveDraft(@CurrentUser() user: Caller, @Param('id') id: string, @Body() dto: SaveDraftDto) {
    return this.templates.saveDraft(id, user, dto);
  }

  @Post(':id/discard-draft')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission(WRITE)
  discardDraft(@CurrentUser() user: Caller, @Param('id') id: string, @Body() dto: RevisionDto) {
    return this.templates.discardDraft(id, user, dto);
  }

  @Post(':id/publish')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission(WRITE)
  publish(@CurrentUser() user: Caller, @Param('id') id: string, @Body() dto: RevisionDto) {
    return this.templates.publish(id, user, dto);
  }

  @Post(':id/rollback')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission(WRITE)
  rollback(@CurrentUser() user: Caller, @Param('id') id: string, @Body() dto: RollbackDto) {
    return this.templates.rollback(id, user, dto);
  }

  @Post(':id/default')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission(WRITE)
  setDefault(@CurrentUser() user: Caller, @Param('id') id: string) {
    return this.templates.setDefault(id, user);
  }

  @Post(':id/archive')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission(WRITE)
  archive(@CurrentUser() user: Caller, @Param('id') id: string) {
    return this.templates.setArchived(id, user, true);
  }

  @Post(':id/restore')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @RequirePermission(WRITE)
  restore(@CurrentUser() user: Caller, @Param('id') id: string) {
    return this.templates.setArchived(id, user, false);
  }

  @Get(':id/versions')
  @RequirePermission(READ)
  versions(@CurrentUser() user: Caller, @Param('id') id: string) {
    return this.templates.versions(id, user);
  }

  @Get(':id/events')
  @RequirePermission(READ)
  events(@CurrentUser() user: Caller, @Param('id') id: string) {
    return this.templates.events(id, user);
  }

  @Get(':id/versions/pdf')
  @RequirePermission(READ)
  async versionPdf(
    @CurrentUser() user: Caller,
    @Param('id') id: string,
    @Query() query: VersionQueryDto,
    @Res() res: Response,
  ) {
    sendPdf(res, await this.templates.previewVersion(id, query.version, user), `v${query.version}.pdf`);
  }
}
