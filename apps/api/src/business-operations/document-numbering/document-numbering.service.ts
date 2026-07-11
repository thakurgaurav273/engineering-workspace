import { Injectable } from '@nestjs/common';
import { BusinessDocumentType, DocumentNumberSequence } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { computeNext, formatNumber, previewNext, NumberConfig } from './document-numbering.util';
import { UpdateDocumentNumberingDto } from './dto/update-document-numbering.dto';

export const DOCUMENT_TYPES: BusinessDocumentType[] = [
  'INVOICE', 'QUOTATION', 'OFFER_LETTER', 'PROPOSAL',
  'PURCHASE_ORDER', 'RECEIPT', 'CREDIT_NOTE', 'DELIVERY_NOTE',
];

const DEFAULT_PREFIX: Record<BusinessDocumentType, string> = {
  INVOICE: 'INV', QUOTATION: 'QTN', OFFER_LETTER: 'OFF', PROPOSAL: 'PROP',
  PURCHASE_ORDER: 'PO', RECEIPT: 'RCPT', CREDIT_NOTE: 'CN', DELIVERY_NOTE: 'DN',
};

function toConfig(row: DocumentNumberSequence): NumberConfig {
  return {
    prefix: row.prefix,
    suffix: row.suffix,
    separator: row.separator,
    startNumber: row.startNumber,
    currentNumber: row.currentNumber,
    padding: row.padding,
    resetMode: row.resetMode,
    useFinancialYear: row.useFinancialYear,
    periodKey: row.periodKey,
  };
}

@Injectable()
export class DocumentNumberingService {
  constructor(private readonly prisma: PrismaService) {}

  private defaults(type: BusinessDocumentType) {
    return {
      prefix: DEFAULT_PREFIX[type],
      suffix: '',
      separator: '-',
      startNumber: 1,
      currentNumber: 0,
      padding: 6,
      resetMode: 'YEARLY' as const,
      useFinancialYear: false,
      periodKey: '',
    };
  }

  private present(type: BusinessDocumentType, row?: DocumentNumberSequence | null) {
    const cfg: NumberConfig = row ? toConfig(row) : this.defaults(type);
    return { documentType: type, ...cfg, preview: previewNext(cfg, new Date()) };
  }

  /** All document types with their config (or defaults if not yet configured). */
  async list(orgId: string) {
    const rows = await this.prisma.documentNumberSequence.findMany({ where: { orgId } });
    const byType = new Map(rows.map((r) => [r.documentType, r]));
    return DOCUMENT_TYPES.map((t) => this.present(t, byType.get(t)));
  }

  async upsert(orgId: string, type: BusinessDocumentType, dto: UpdateDocumentNumberingDto) {
    const row = await this.prisma.documentNumberSequence.upsert({
      where: { orgId_documentType: { orgId, documentType: type } },
      create: { orgId, documentType: type, ...this.defaults(type), ...dto },
      update: { ...dto },
    });
    return this.present(type, row);
  }

  /** Preview the next number with optional draft overrides - does NOT reserve. */
  async preview(orgId: string, type: BusinessDocumentType, draft?: UpdateDocumentNumberingDto) {
    const existing = await this.prisma.documentNumberSequence.findUnique({
      where: { orgId_documentType: { orgId, documentType: type } },
    });
    const cfg: NumberConfig = { ...(existing ? toConfig(existing) : this.defaults(type)), ...(draft ?? {}) };
    return { documentType: type, preview: previewNext(cfg, new Date()) };
  }

  private ensure(orgId: string, type: BusinessDocumentType) {
    return this.prisma.documentNumberSequence.upsert({
      where: { orgId_documentType: { orgId, documentType: type } },
      create: { orgId, documentType: type, ...this.defaults(type) },
      update: {},
    });
  }

  /**
   * Atomically reserve the next number. Concurrency-safe: a `SELECT ... FOR UPDATE`
   * inside a transaction takes a row lock, so concurrent callers for the same
   * (org, documentType) serialize - no duplicates, no skips. This is the single source of
   * truth every document module (invoices, quotations, …) calls.
   */
  async next(
    orgId: string,
    type: BusinessDocumentType,
  ): Promise<{ documentType: BusinessDocumentType; number: string; sequence: number }> {
    await this.ensure(orgId, type);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<DocumentNumberSequence[]>`
        SELECT * FROM "DocumentNumberSequence"
        WHERE "orgId" = ${orgId} AND "documentType" = ${type}::"BusinessDocumentType"
        FOR UPDATE`;
      const row = rows[0];
      const now = new Date();
      const cfg = toConfig(row);
      const { issued, periodKey } = computeNext(cfg, now);
      await tx.documentNumberSequence.update({
        where: { orgId_documentType: { orgId, documentType: type } },
        data: { currentNumber: issued, periodKey },
      });
      return { documentType: type, number: formatNumber(cfg, issued, now), sequence: issued };
    });
  }
}
