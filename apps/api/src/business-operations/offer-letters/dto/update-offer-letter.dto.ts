import { PartialType } from '@nestjs/swagger';
import { CreateOfferLetterDto } from './create-offer-letter.dto';

export class UpdateOfferLetterDto extends PartialType(CreateOfferLetterDto) {}
