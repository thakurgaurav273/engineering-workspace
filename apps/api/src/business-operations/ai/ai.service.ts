import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CompanyService } from '../company/company.service';
import { ClientsService } from '../clients/clients.service';
import { InvoicesService } from '../invoices/invoices.service';
import { CreateInvoiceDto, INVOICE_TYPES, InvoiceTypeValue } from '../invoices/dto/create-invoice.dto';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';

/** GrovynDashboard invoice-type display strings → our InvoiceType enum values. */
const TYPE_FROM_LABEL: Record<string, InvoiceTypeValue> = {
  'standard invoice': 'STANDARD',
  'proforma invoice': 'PROFORMA',
  'tax invoice': 'TAX',
  'credit note': 'CREDIT_NOTE',
  'debit note': 'DEBIT_NOTE',
  'recurring invoice': 'RECURRING',
  'advance invoice': 'ADVANCE',
  'final settlement invoice': 'FINAL_SETTLEMENT',
};

interface AiItem {
  name?: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  taxRate?: number;
  hsnSac?: string;
}
interface AiDraft {
  invoiceType?: string;
  dueDate?: string;
  projectName?: string;
  items?: AiItem[];
  discountPercentage?: number;
  notes?: unknown;
  timeline?: unknown;
  deliverables?: unknown;
  paymentTerms?: unknown;
  confidence?: number;
}

export interface InvoiceDraftResult {
  draft: CreateInvoiceDto;
  confidence: number;
  invoice?: unknown; // present when persisted
}

/**
 * AI-assisted invoice drafting. Mirrors GrovynDashboard: a single natural-language prompt is
 * turned into a structured draft by an LLM (Hugging Face router, OpenAI-compatible), then
 * normalised into a CreateInvoiceDto. It NEVER computes totals or numbers itself — the parsed
 * draft flows through InvoicesService like any manual draft. Requires HF_API_KEY.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly company: CompanyService,
    private readonly clients: ClientsService,
    private readonly invoices: InvoicesService,
  ) {}

  /** Whether the AI integration is configured (surfaced to the UI so it can hide the feature). */
  isConfigured(): boolean {
    return !!process.env.HF_API_KEY && process.env.HF_API_KEY.trim() !== '';
  }

  async generateInvoiceDraft(orgId: string, dto: GenerateInvoiceDto): Promise<InvoiceDraftResult> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'AI generation is not configured. Set HF_API_KEY in the API environment.',
      );
    }

    const [company, client] = await Promise.all([
      this.company.getForOrg(orgId),
      this.clients.findOne(dto.clientId, orgId),
    ]);

    const text = await this.callModel(this.buildPrompt(dto.prompt, client, company));
    const parsed = this.parse(text);
    const draft = this.toCreateDto(dto.clientId, parsed);

    const result: InvoiceDraftResult = {
      draft,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    };
    if (dto.persist !== false) {
      result.invoice = await this.invoices.create(orgId, draft);
    }
    return result;
  }

  // --- Hugging Face router (OpenAI-compatible chat completions) ------------------------------

  private async callModel(userPrompt: string): Promise<string> {
    const apiKey = process.env.HF_API_KEY!;
    let model = process.env.HF_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2';
    if (!model.includes(':')) model = `${model}:featherless-ai`;

    let response: Response;
    try {
      response = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'You are an invoice data extraction assistant. Extract structured invoice ' +
                'details from the user input and return ONLY valid JSON matching the provided ' +
                'schema. Do not include any markdown formatting or code blocks.',
            },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 800,
          top_p: 0.95,
        }),
      });
    } catch (err) {
      this.logger.error(`Hugging Face request failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Could not reach the AI provider.');
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      this.logger.error(`Hugging Face API error ${response.status}: ${errorText.slice(0, 300)}`);
      throw new ServiceUnavailableException(`AI provider error (${response.status}).`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new BadRequestException('AI provider returned an empty response.');
    return content;
  }

  // --- Prompt + parsing ---------------------------------------------------------------------

  private buildPrompt(
    prompt: string,
    client: { name: string; companyName?: string | null; gstin?: string | null; billingState?: string | null; billingCountry?: string | null },
    company: { legalName?: string; state?: string | null; country?: string | null; gstin?: string | null } | null,
  ): string {
    const companyGst = company?.gstin ? 'Yes' : 'No';
    const clientGst = client.gstin ? 'Yes' : 'No';
    const currency = (company?.country ?? 'India') === 'India' ? 'INR' : 'USD';

    return `You are an invoice data extraction assistant for an MSME invoice management system.

Given the following input, extract structured invoice details.
Return ONLY valid JSON matching the schema below. Do not include any markdown formatting or code blocks.

Company Context:
- Company: ${company?.legalName ?? 'Our company'}
- GST Enabled: ${companyGst}
- Default GST Rate: 18%
- Currency: ${currency}
- State: ${company?.state ?? 'Unknown'}

Client Context:
- Client Name: ${client.name}${client.companyName ? ` (${client.companyName})` : ''}
- Client State: ${client.billingState ?? 'Unknown'}
- Client Country: ${client.billingCountry ?? 'Unknown'}
- GST Registered: ${clientGst}
${client.gstin ? `- GSTIN: ${client.gstin}` : ''}

User Input:
"${prompt}"

Required JSON Schema:
{
  "invoiceType": "Tax Invoice | Proforma Invoice | Standard Invoice | Credit Note | Debit Note | Recurring Invoice | Advance Invoice | Final Settlement Invoice",
  "dueDate": "YYYY-MM-DD",
  "projectName": "string",
  "items": [
    { "name": "string", "description": "string", "quantity": number, "unitPrice": number, "taxRate": number, "hsnSac": "string (optional)" }
  ],
  "discountPercentage": number,
  "notes": "string (optional)",
  "paymentTerms": "string (optional)",
  "confidence": number
}

Important Rules:
1. If the client country is not India, use taxRate 0 (export / no GST).
2. For IT/software services, use HSN/SAC code 998311 and taxRate 18.
3. If an amount is not specified, use 0 for unitPrice.
4. DO NOT include comments in the JSON. Use actual values, never placeholders.

Return ONLY valid JSON with no comments, no markdown formatting, and no explanatory text.`;
  }

  /** Salvage a JSON object from a possibly-noisy model response. */
  private parse(text: string): AiDraft {
    let cleaned = text.trim().replace(/^```(?:json)?\s*/im, '').replace(/\s*```$/im, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) {
      throw new BadRequestException('The AI response did not contain valid invoice data.');
    }
    cleaned = cleaned
      .substring(start, end + 1)
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/,(\s*[}\]])/g, '$1');
    try {
      return JSON.parse(cleaned) as AiDraft;
    } catch {
      throw new BadRequestException('The AI response was not valid JSON.');
    }
  }

  private flatten(v: unknown): string | undefined {
    if (Array.isArray(v)) return v.filter(Boolean).join('\n');
    if (typeof v === 'string') return v || undefined;
    return undefined;
  }

  /** Normalise the parsed draft into a CreateInvoiceDto our services already understand. */
  private toCreateDto(clientId: string, d: AiDraft): CreateInvoiceDto {
    const items = Array.isArray(d.items) ? d.items : [];
    if (items.length === 0) {
      throw new BadRequestException('The AI response did not include any line items.');
    }

    const invoiceType =
      TYPE_FROM_LABEL[String(d.invoiceType ?? '').trim().toLowerCase()] ?? 'STANDARD';
    const discount = clamp(d.discountPercentage, 0, 100);

    const notesParts = [
      d.projectName ? `Project: ${d.projectName}` : undefined,
      this.flatten(d.notes),
      this.flatten(d.timeline) ? `Timeline: ${this.flatten(d.timeline)}` : undefined,
      this.flatten(d.deliverables) ? `Deliverables: ${this.flatten(d.deliverables)}` : undefined,
    ].filter(Boolean);

    const dto: CreateInvoiceDto = {
      clientId,
      invoiceType: INVOICE_TYPES.includes(invoiceType) ? invoiceType : 'STANDARD',
      notes: notesParts.length ? notesParts.join('\n') : undefined,
      terms: this.flatten(d.paymentTerms),
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(d.dueDate ?? '')) ? d.dueDate : undefined,
      lines: items.map((it) => {
        const rate = clamp(it.taxRate, 0, 100);
        return {
          description: [it.name, it.description].filter(Boolean).join(' — ') || 'Item',
          quantity: numeric(it.quantity, 1),
          unitPrice: numeric(it.unitPrice, 0),
          discount: discount || undefined,
          discountType: discount ? ('PERCENT' as const) : undefined,
          taxes: rate ? [{ type: 'GST' as const, rate }] : [],
        };
      }),
    };
    return dto;
  }
}

function numeric(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
function clamp(v: unknown, min: number, max: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, n));
}
