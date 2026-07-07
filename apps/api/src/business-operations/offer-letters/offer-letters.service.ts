import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OfferLetterStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyService } from '../company/company.service';
import { DocumentNumberingService } from '../document-numbering/document-numbering.service';
import { MailService } from '../../platform/mail/mail.service';
import { PdfService } from '../../platform/pdf/pdf.service';
import { renderOfferLetter } from './offer-letter-template';
import { CreateOfferLetterDto } from './dto/create-offer-letter.dto';
import { UpdateOfferLetterDto } from './dto/update-offer-letter.dto';
import { ListOfferLettersDto } from './dto/list-offer-letters.dto';

/**
 * Offer Letter orchestration. An HR document for a candidate (not a client).
 * Non-financial — no Tax Engine. Reuses CompanyService for the company snapshot and
 * DocumentNumberingService('OFFER_LETTER') to reserve a permanent number at SEND.
 * Editable while DRAFT; read-only once SENT.
 */
@Injectable()
export class OfferLettersService {
  private readonly logger = new Logger(OfferLettersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly company: CompanyService,
    private readonly numbering: DocumentNumberingService,
    private readonly mail: MailService,
    private readonly pdf: PdfService,
  ) {}

  private toData(dto: CreateOfferLetterDto | UpdateOfferLetterDto) {
    return {
      candidateName: dto.candidateName, candidateEmail: dto.candidateEmail,
      candidatePhone: dto.candidatePhone, candidateAddress: dto.candidateAddress,
      position: dto.position, department: dto.department, designation: dto.designation,
      reportingManager: dto.reportingManager,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      employmentType: dto.employmentType, workLocation: dto.workLocation,
      baseSalary: dto.baseSalary, currency: dto.currency, variablePay: dto.variablePay,
      salaryBreakdown: dto.salaryBreakdown, benefits: dto.benefits,
      noticePeriod: dto.noticePeriod, probationPeriod: dto.probationPeriod,
      termsAndConditions: dto.termsAndConditions, additionalNotes: dto.additionalNotes,
      offerDate: dto.offerDate ? new Date(dto.offerDate) : undefined,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
    };
  }

  async create(orgId: string, dto: CreateOfferLetterDto) {
    const company = await this.company.getForOrg(orgId);
    return this.prisma.offerLetter.create({
      data: {
        orgId, status: 'DRAFT',
        companySnapshot: (company ?? null) as Prisma.InputJsonValue,
        ...this.toData(dto),
        candidateName: dto.candidateName, candidateEmail: dto.candidateEmail, position: dto.position,
      },
    });
  }

  async update(id: string, orgId: string, dto: UpdateOfferLetterDto) {
    const offer = await this.findOne(id, orgId);
    if (offer.status !== 'DRAFT') throw new BadRequestException('Only draft offer letters can be edited');
    const company = await this.company.getForOrg(orgId);
    return this.prisma.offerLetter.update({
      where: { id },
      data: { companySnapshot: (company ?? null) as Prisma.InputJsonValue, ...this.toData(dto) },
    });
  }

  async findOne(id: string, orgId: string) {
    const offer = await this.prisma.offerLetter.findFirst({ where: { id, orgId } });
    if (!offer) throw new NotFoundException('Offer letter not found');
    return offer;
  }

  async list(orgId: string, query: ListOfferLettersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.OfferLetterWhereInput = { orgId };
    if (query.status) where.status = query.status;
    if (query.employmentType) where.employmentType = query.employmentType;
    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { candidateName: { contains: term, mode: 'insensitive' } },
        { candidateEmail: { contains: term, mode: 'insensitive' } },
        { position: { contains: term, mode: 'insensitive' } },
        { number: { contains: term, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.offerLetter.findMany({
        where, orderBy: { [query.sort ?? 'createdAt']: query.order ?? 'desc' },
        skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.offerLetter.count({ where }),
    ]);
    return { success: true, data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /** The exact document the candidate receives — same renderer used by send(). Read-safe. */
  async preview(id: string, orgId: string) {
    const offer = await this.findOne(id, orgId);
    const { subject, html } = renderOfferLetter(offer);
    return { to: offer.candidateEmail, subject, html };
  }

  /** The offer letter as a PDF buffer (same document as the preview/email attachment). */
  async toPdf(id: string, orgId: string): Promise<{ fileName: string; buffer: Buffer }> {
    const offer = await this.findOne(id, orgId);
    const { html, fileName } = renderOfferLetter(offer);
    return { fileName, buffer: await this.pdf.fromHtml(html) };
  }

  /**
   * Reserve the number, render the letter, and EMAIL it to the candidate with a formatted PDF
   * attached. The DB is only advanced to SENT after the email succeeds — if delivery throws,
   * the offer letter stays DRAFT (the UI surfaces the error), so "Sent" always means delivered.
   * PDF generation degrades gracefully: if Chromium is unavailable the letter is still emailed
   * (HTML body), just without the attachment, and a warning is logged.
   */
  async send(id: string, orgId: string) {
    const offer = await this.findOne(id, orgId);
    if (offer.status !== 'DRAFT') throw new BadRequestException('Only draft offer letters can be sent');

    const reserved = await this.numbering.next(orgId, 'OFFER_LETTER');
    const { subject, html, fileName } = renderOfferLetter({ ...offer, number: reserved.number });

    let attachments: { filename: string; content: Buffer }[] | undefined;
    try {
      attachments = [{ filename: fileName, content: await this.pdf.fromHtml(html) }];
    } catch (err) {
      this.logger.warn(`Offer letter ${reserved.number}: PDF generation failed, sending without attachment — ${(err as Error).message}`);
    }

    // Email BEFORE persisting SENT: a delivery failure propagates and leaves the row DRAFT.
    await this.mail.sendOfferLetterEmail(offer.candidateEmail, subject, html, attachments);

    return this.prisma.offerLetter.update({
      where: { id },
      data: { number: reserved.number, status: 'SENT', offerDate: offer.offerDate ?? new Date(), sentAt: new Date() },
    });
  }

  // `stamp` is a factory so the timestamp is taken at call time, not at construction.
  private async transition(
    id: string,
    orgId: string,
    from: OfferLetterStatus[],
    to: OfferLetterStatus,
    stamp?: () => Prisma.OfferLetterUpdateInput,
  ) {
    const offer = await this.findOne(id, orgId);
    if (!from.includes(offer.status)) {
      throw new BadRequestException(`Cannot move an offer letter from ${offer.status} to ${to}`);
    }
    return this.prisma.offerLetter.update({ where: { id }, data: { status: to, ...(stamp?.() ?? {}) } });
  }

  accept(id: string, orgId: string) {
    return this.transition(id, orgId, ['SENT'], 'ACCEPTED', () => ({ acceptedAt: new Date() }));
  }
  reject(id: string, orgId: string) {
    return this.transition(id, orgId, ['SENT'], 'REJECTED', () => ({ rejectedAt: new Date() }));
  }
  cancel(id: string, orgId: string) {
    return this.transition(id, orgId, ['SENT', 'ACCEPTED'], 'CANCELLED');
  }

  async duplicate(id: string, orgId: string) {
    const o = await this.findOne(id, orgId);
    return this.create(orgId, {
      candidateName: o.candidateName, candidateEmail: o.candidateEmail,
      candidatePhone: o.candidatePhone ?? undefined, candidateAddress: o.candidateAddress ?? undefined,
      position: o.position, department: o.department ?? undefined, designation: o.designation ?? undefined,
      reportingManager: o.reportingManager ?? undefined,
      startDate: o.startDate?.toISOString(), employmentType: o.employmentType,
      workLocation: o.workLocation ?? undefined, baseSalary: o.baseSalary, currency: o.currency,
      variablePay: o.variablePay ?? undefined, salaryBreakdown: o.salaryBreakdown ?? undefined,
      benefits: o.benefits ?? undefined, noticePeriod: o.noticePeriod ?? undefined,
      probationPeriod: o.probationPeriod ?? undefined, termsAndConditions: o.termsAndConditions ?? undefined,
      additionalNotes: o.additionalNotes ?? undefined, validUntil: o.validUntil?.toISOString(),
    });
  }

  async remove(id: string, orgId: string) {
    const offer = await this.findOne(id, orgId);
    if (offer.status !== 'DRAFT') throw new BadRequestException('Only draft offer letters can be deleted');
    await this.prisma.offerLetter.delete({ where: { id } });
    return { deleted: true };
  }
}
