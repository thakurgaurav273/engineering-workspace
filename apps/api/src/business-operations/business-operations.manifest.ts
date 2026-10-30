import {
  ApplicationManifest,
  ApplicationStatus,
} from '../kernel/registry/application-manifest';
import { BaseApplication } from '../kernel/registry/base-application';

/**
 * Business Operations - Application #2. Covers the full GrovynDashboard scope (invoices,
 * quotations, proposals, offer letters, clients, payments). Gated by the
 * `business-operations` feature flag; EXPERIMENTAL while it is placeholder-only.
 * Business logic and Prisma models are NOT part of this phase.
 */
export const BUSINESS_OPERATIONS_MANIFEST: ApplicationManifest = {
  id: 'business-operations',
  key: 'business-operations',
  name: 'Business Operations',
  description: 'Invoices, quotations, proposals, offer letters, clients and payments.',
  icon: 'Receipt',
  category: 'operations',
  order: 20,
  routePrefix: '/business',
  version: '0.1.0',
  owner: 'Business Operations',
  featureFlag: 'business-operations',
  requiresSuperAdmin: false,
  minimumPlatformRole: null,
  status: ApplicationStatus.EXPERIMENTAL,
  navigation: [
    { label: 'Dashboard', path: '/business/dashboard', icon: 'LayoutDashboard' },
    { label: 'Clients', path: '/business/clients', icon: 'Users' },
    { label: 'Quotations', path: '/business/quotations', icon: 'FileText' },
    { label: 'Invoices', path: '/business/invoices', icon: 'Receipt' },
    { label: 'Payments', path: '/business/payments', icon: 'CreditCard' },
    { label: 'Proposals', path: '/business/proposals', icon: 'FileText' },
    { label: 'Offer Letters', path: '/business/offer-letters', icon: 'FileSignature' },
    { label: 'Templates', path: '/business/templates', icon: 'LayoutTemplate' },
    { label: 'Company', path: '/business/company', icon: 'Building2' },
    { label: 'Settings', path: '/business/settings', icon: 'Settings' },
  ],
  permissions: [
    'business-operations:client:read',
    'business-operations:client:write',
    'business-operations:company:read',
    'business-operations:company:write',
    'business-operations:invoice:read',
    'business-operations:invoice:write',
    'business-operations:invoice:issue',
    'business-operations:quotation:read',
    'business-operations:quotation:write',
    'business-operations:quotation:issue',
    'business-operations:offer-letter:read',
    'business-operations:offer-letter:write',
    'business-operations:offer-letter:send',
    'business-operations:proposal:read',
    'business-operations:proposal:write',
    'business-operations:proposal:send',
    'business-operations:payment:read',
    'business-operations:payment:write',
    'business-operations:document-numbering:read',
    'business-operations:document-numbering:write',
    'business-operations:tax:read',
    'business-operations:tax:write',
    'business-operations:document-template:read',
    'business-operations:document-template:write',
  ],
  dependencies: [],
  events: [],
  // Turns a natural-language description into an invoice draft (Hugging Face). Requires
  // HF_API_KEY; reuses the invoice:write permission.
  aiTools: ['business-operations:ai:invoice-draft'],
};

export class BusinessOperationsApplication extends BaseApplication {
  readonly manifest = BUSINESS_OPERATIONS_MANIFEST;
}

export const businessOperationsApplication = new BusinessOperationsApplication();
