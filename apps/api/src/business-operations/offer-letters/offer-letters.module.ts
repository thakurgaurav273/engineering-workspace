import { Module } from '@nestjs/common';
import { CompanyModule } from '../company/company.module';
import { DocumentNumberingModule } from '../document-numbering/document-numbering.module';
import { MailModule } from '../../platform/mail/mail.module';
import { PdfModule } from '../../platform/pdf/pdf.module';
import { OfferLettersController } from './offer-letters.controller';
import { OfferLettersService } from './offer-letters.service';
import { OfferLetterTemplatesController } from './offer-letter-templates.controller';
import { OfferLetterTemplatesService } from './offer-letter-templates.service';

/**
 * Business Operations - Offer Letters. HR document (candidate-based, no client).
 * Imports CompanyModule (snapshot) + DocumentNumberingModule (number at send). No tax.
 */
@Module({
  imports: [CompanyModule, DocumentNumberingModule, MailModule, PdfModule],
  controllers: [OfferLettersController, OfferLetterTemplatesController],
  providers: [OfferLettersService, OfferLetterTemplatesService],
  exports: [OfferLettersService],
})
export class OfferLettersModule {}
