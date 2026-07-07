import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Browser } from 'puppeteer';

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
      // Reuse only if the cached browser is still alive — a crashed/disconnected Chromium
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

  /** Render a complete HTML document to an A4 PDF buffer. Throws if Chromium is unavailable. */
  async fromHtml(html: string): Promise<Buffer> {
    const browser = await this.browser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
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
