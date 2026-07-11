import { ServiceUnavailableException } from '@nestjs/common';
import { AiService } from './ai.service';
import { CompanyService } from '../company/company.service';
import { ClientsService } from '../clients/clients.service';
import { InvoicesService } from '../invoices/invoices.service';

function make() {
  const company = { getForOrg: async () => ({ legalName: 'Grovyn', state: 'KA', country: 'India', gstin: '29ABCDE1234F1Z5' }) } as unknown as CompanyService;
  const clients = {
    findOne: async (id: string) => ({ id, name: 'Acme', companyName: 'Acme Pvt', gstin: '29XXX', billingState: 'KA', billingCountry: 'India' }),
  } as unknown as ClientsService;
  const created: unknown[] = [];
  const invoices = {
    create: async (_org: string, dto: unknown) => {
      created.push(dto);
      return { id: 'inv1', status: 'DRAFT', ...(dto as object) };
    },
  } as unknown as InvoicesService;
  const svc = new AiService(company, clients, invoices);
  return { svc, invoices, created };
}

function mockFetch(content: string, ok = true, status = 200) {
  (global as unknown as { fetch: unknown }).fetch = jest.fn(async () => ({
    ok,
    status,
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => content,
  }));
}

const OLD_ENV = process.env;
afterEach(() => {
  process.env = OLD_ENV;
  jest.restoreAllMocks();
});

describe('AiService (invoice drafting)', () => {
  it('is not configured without HF_API_KEY and refuses to generate', async () => {
    process.env = { ...OLD_ENV, HF_API_KEY: '' };
    const { svc } = make();
    expect(svc.isConfigured()).toBe(false);
    await expect(svc.generateInvoiceDraft('org1', { clientId: 'c1', prompt: 'x' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('parses model JSON into a normalised draft and persists it', async () => {
    process.env = { ...OLD_ENV, HF_API_KEY: 'hf_test' };
    mockFetch(
      '```json\n{ "invoiceType": "Tax Invoice", "dueDate": "2026-08-01", "projectName": "Website", ' +
        '"items": [{ "name": "Design", "description": "Landing page", "quantity": 2, "unitPrice": 500, "taxRate": 18 }], ' +
        '"discountPercentage": 10, "notes": "Rush job", "confidence": 0.9 }\n```',
    );
    const { svc, created } = make();
    const res = await svc.generateInvoiceDraft('org1', { clientId: 'c1', prompt: 'invoice acme' });

    expect(res.confidence).toBe(0.9);
    expect(res.invoice).toBeDefined();
    const draft = created[0] as { clientId: string; invoiceType: string; dueDate?: string; lines: { description: string; quantity: number; unitPrice: number; discount?: number; taxes: { rate: number }[] }[] };
    expect(draft.clientId).toBe('c1');
    expect(draft.invoiceType).toBe('TAX');
    expect(draft.dueDate).toBe('2026-08-01');
    expect(draft.lines).toHaveLength(1);
    expect(draft.lines[0].description).toBe('Design - Landing page');
    expect(draft.lines[0].quantity).toBe(2);
    expect(draft.lines[0].discount).toBe(10);
    expect(draft.lines[0].taxes[0].rate).toBe(18);
  });

  it('does not persist when persist=false', async () => {
    process.env = { ...OLD_ENV, HF_API_KEY: 'hf_test' };
    mockFetch('{ "invoiceType": "Standard Invoice", "items": [{ "name": "Item", "quantity": 1, "unitPrice": 100, "taxRate": 0 }], "confidence": 0.7 }');
    const { svc, created } = make();
    const res = await svc.generateInvoiceDraft('org1', { clientId: 'c1', prompt: 'x', persist: false });
    expect(created).toHaveLength(0);
    expect(res.invoice).toBeUndefined();
    expect(res.draft.invoiceType).toBe('STANDARD');
    expect(res.draft.lines[0].taxes).toHaveLength(0);
  });

  it('rejects a response with no JSON object', async () => {
    process.env = { ...OLD_ENV, HF_API_KEY: 'hf_test' };
    mockFetch('Sorry, I cannot help with that.');
    const { svc } = make();
    await expect(svc.generateInvoiceDraft('org1', { clientId: 'c1', prompt: 'x' })).rejects.toThrow();
  });

  it('surfaces upstream provider errors', async () => {
    process.env = { ...OLD_ENV, HF_API_KEY: 'hf_test' };
    mockFetch('rate limited', false, 429);
    const { svc } = make();
    await expect(svc.generateInvoiceDraft('org1', { clientId: 'c1', prompt: 'x' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
