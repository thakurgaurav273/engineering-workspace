import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Browser } from 'puppeteer';

export interface PdfOptions {
  /** Adds a "Page X of Y" footer at this position. */
  pageNumbers?: 'left' | 'center' | 'right' | null;
}

const RENDER_TIMEOUT_MS = 20_000;

/**
 * Hosts a document may load images/fonts from: our upload stores plus Google Fonts, and any
 * extra hosts in PDF_ALLOWED_HOSTS (comma-separated). Everything else is blocked.
 */
export function allowedAssetHosts(): string[] {
  const hosts = new Set(['res.cloudinary.com', 'fonts.googleapis.com', 'fonts.gstatic.com']);
  for (const url of [process.env.R2_PUBLIC_URL, process.env.FRONTEND_URL]) {
    try {
      if (url) hosts.add(new URL(url).hostname);
    } catch {
      // ignore malformed env values
    }
  }
  for (const host of (process.env.PDF_ALLOWED_HOSTS ?? '').split(',')) {
    if (host.trim()) hosts.add(host.trim().toLowerCase());
  }
  return [...hosts];
}

function isAllowedAsset(url: string): boolean {
  if (url.startsWith('data:') || url.startsWith('about:')) return true;
  try {
    const { protocol, hostname } = new URL(url);
    return (protocol === 'https:' || protocol === 'http:') && allowedAssetHosts().includes(hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Renders self-contained HTML to a PDF via a headless Chromium (Puppeteer). One browser
 * instance is launched lazily and reused across requests; a fresh page is opened per render.
 * Kept provider-agnostic so any module (offer letters today, invoices/quotations later) can
 * turn its existing HTML document into a pixel-faithful PDF.
 */
@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browserPromise: Promise<Browser> | null = null;

  private async browser(): Promise<Browser> {
    if (this.browserPromise) {
      // Reuse only if the cached browser is still alive - a crashed/disconnected Chromium
      // (process died, dev-server reload, OOM) must be relaunched, not reused.
      const existing = await this.browserPromise.catch(() => null);
      if (existing && existing.connected) return existing;
      this.browserPromise = null;
    }
    // Dynamic import so the (heavy) module only loads when a PDF is actually requested.
    const puppeteer = (await import('puppeteer')).default;
    this.browserPromise = puppeteer
      .launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
      .catch((err) => {
        this.browserPromise = null; // allow a later retry
        throw err;
      });
    return this.browserPromise;
  }

  /**
   * Render a complete HTML document to a PDF buffer (A4 unless the document's CSS @page says
   * otherwise). Throws if Chromium is unavailable. Documents can be org-authored templates, so
   * the page runs with JavaScript off and may only load images/fonts from allowed hosts.
   */
  async fromHtml(html: string, options: PdfOptions = {}): Promise<Buffer> {
    const browser = await this.browser();
    const page = await browser.newPage();
    try {
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (isAllowedAsset(request.url())) request.continue().catch(() => {});
        else request.abort('blockedbyclient').catch(() => {});
      });
      await page.setContent(html, { waitUntil: 'load', timeout: RENDER_TIMEOUT_MS });
      const footer = options.pageNumbers
        ? `<div style="width:100%;font-size:8px;color:#6b7280;padding:0 12mm;text-align:${options.pageNumbers};font-family:Helvetica,Arial,sans-serif;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`
        : undefined;
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        timeout: RENDER_TIMEOUT_MS,
        ...(footer && { displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: footer }),
      });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => {});
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.browserPromise) return;
    const browser = await this.browserPromise.catch(() => null);
    await browser?.close().catch(() => {});
  }
}
