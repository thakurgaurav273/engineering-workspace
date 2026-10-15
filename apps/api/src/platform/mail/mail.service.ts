import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { Resend } from 'resend';
import { isStagingSafeMode } from '@/common/safe-mode';
import { getBrand } from '@/common/brand';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  // Hex equivalents of the app's light-theme CSS variables (src/styles.css) -
  // email clients can't render oklch(), so these are hand-converted matches.
  private readonly theme = {
    background: '#fdfdfc',
    foreground: '#1c1d22',
    card: '#ffffff',
    border: '#e4e5e9',
    muted: '#f5f5f7',
    mutedForeground: '#84858c',
    accentGreen: '#059669',
    fontSans: `'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif`,
    fontMono: `'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace`,
  };

  private layout(bodyHtml: string): string {
    const t = this.theme;
    const brand = getBrand();
    // The configured logo, else a monogram tile of the platform name.
    const mark = brand.logoUrl
      ? `<img src="${brand.logoUrl}" alt="" width="28" height="28" style="width: 28px; height: 28px; border-radius: 8px; object-fit: contain; display: inline-block; vertical-align: middle;" />`
      : `<div style="width: 28px; height: 28px; border-radius: 8px; background: ${t.accentGreen}; color: #fff; font-weight: 700; font-size: 15px; text-align: center; line-height: 28px; display: inline-block; vertical-align: middle;">${brand.name.charAt(0).toUpperCase()}</div>`;
    return `
      <div style="font-family: ${t.fontSans}; max-width: 480px; margin: 0 auto; padding: 32px 16px; background: ${t.background};">
        <div style="margin-bottom: 20px;">
          ${mark}
          <span style="display: inline-block; vertical-align: middle; margin-left: 10px; font-size: 14px; font-weight: 600; color: ${t.foreground}; letter-spacing: -0.01em;">${brand.name}</span>
        </div>
        <div style="background: ${t.card}; border: 1px solid ${t.border}; border-radius: 12px; padding: 28px;">
          ${bodyHtml}
        </div>
        <p style="margin-top: 20px; font-size: 11.5px; color: ${t.mutedForeground}; text-align: center;">
          ${brand.tagline ? `${brand.name} · ${brand.tagline}` : brand.name}
        </p>
      </div>
    `;
  }

  private button(label: string, url: string): string {
    const t = this.theme;
    return `<a href="${url}" style="display: inline-block; background: ${t.foreground}; color: ${t.background}; text-decoration: none; padding: 9px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; font-family: ${t.fontSans};">${label}</a>`;
  }

  private credentialsBlock(email: string, password: string, loginUrl: string): string {
    const t = this.theme;
    return `
      <div style="background: ${t.muted}; border-radius: 8px; padding: 16px 18px; margin: 18px 0;">
        <div style="font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: ${t.mutedForeground}; margin-bottom: 3px;">Email</div>
        <div style="font-size: 13.5px; font-weight: 500; color: ${t.foreground}; margin-bottom: 14px;">${email}</div>
        <div style="font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: ${t.mutedForeground}; margin-bottom: 3px;">Password</div>
        <div style="font-size: 14.5px; font-weight: 600; font-family: ${t.fontMono}; letter-spacing: 0.01em; color: ${t.foreground};">${password}</div>
      </div>
      ${this.button(`Log in to ${getBrand().name}`, loginUrl)}
      <p style="margin-top: 18px; font-size: 12px; color: ${t.mutedForeground}; line-height: 1.5;">For your security, we recommend changing this password after logging in.</p>
    `;
  }

  private async send(
    to: string,
    subject: string,
    html: string,
    fallbackLog: string,
    attachments?: { filename: string; content: Buffer }[],
  ): Promise<void> {
    if (isStagingSafeMode()) {
      this.logger.warn(`STAGING_SAFE_MODE on - suppressing email to ${to}, logging instead`);
      this.logger.log(fallbackLog);
      return;
    }

    if (!this.resend) {
      this.logger.warn(`RESEND_API_KEY not set - logging instead of sending email`);
      this.logger.log(fallbackLog);
      return;
    }

    const result = await this.resend.emails.send({
      from: process.env.MAIL_FROM || `${getBrand().name} <onboarding@resend.dev>`,
      to,
      subject,
      html,
      ...(attachments?.length ? { attachments } : {}),
    });

    // The Resend SDK resolves normally even on API-level failures (rate limits,
    // invalid recipient, domain issues) - it never throws, it returns { error }.
    // Checking result.error is the only way to detect a failed send.
    if (result.error) {
      this.logger.error(`Failed to send email to ${to}: ${result.error.name} - ${result.error.message}`);
      throw new InternalServerErrorException(`Failed to send email: ${result.error.message}`);
    }
  }

  async sendInviteEmail(
    to: string,
    inviteUrl: string,
    orgName: string,
    inviterName: string,
  ): Promise<void> {
    await this.send(
      to,
      `${inviterName} invited you to join ${orgName} on ${getBrand().name}`,
      this.layout(`
        <p style="font-size: 15px; line-height: 1.5; margin-top: 0;">${inviterName} has invited you to join <strong>${orgName}</strong> on ${getBrand().name}.</p>
        <div style="margin: 18px 0;">${this.button('Accept invitation', inviteUrl)}</div>
        <p style="font-size: 12px; color: ${this.theme.mutedForeground};">This link expires in 7 days.</p>
      `),
      `Invite for ${to} to join ${orgName}: ${inviteUrl}`,
    );
  }

  /**
   * Sends a fully-rendered offer letter. The HTML is the complete document (its own layout),
   * so it is passed through verbatim rather than wrapped in the transactional email layout.
   * Throws if delivery fails, so the caller can keep the offer letter in DRAFT.
   */
  async sendOfferLetterEmail(
    to: string,
    subject: string,
    html: string,
    attachments?: { filename: string; content: Buffer }[],
  ): Promise<void> {
    await this.send(to, subject, html, `Offer letter for ${to}: ${subject}`, attachments);
  }

  /**
   * Sends a fully-rendered business document (invoice, quotation, proposal). Like the offer
   * letter, the HTML is a complete document with its own layout, so it is passed through
   * verbatim (not wrapped in the transactional layout). Throws if delivery fails.
   */
  async sendDocumentEmail(
    to: string,
    subject: string,
    html: string,
    attachments?: { filename: string; content: Buffer }[],
  ): Promise<void> {
    await this.send(to, subject, html, `Document for ${to}: ${subject}`, attachments);
  }

  async sendWelcomeEmail(
    to: string,
    password: string,
    orgName: string,
    inviterName: string,
    loginUrl: string,
  ): Promise<void> {
    await this.send(
      to,
      `${inviterName} added you to ${orgName} on ${getBrand().name}`,
      this.layout(`
        <p style="font-size: 15px; line-height: 1.5;">${inviterName} has added you to <strong>${orgName}</strong> on ${getBrand().name}. Your account is ready - here are your login details:</p>
        ${this.credentialsBlock(to, password, loginUrl)}
      `),
      `Account created for ${to} in ${orgName}. Password: ${password} Login: ${loginUrl}`,
    );
  }

  async sendPasswordResetEmail(
    to: string,
    password: string,
    orgName: string,
    loginUrl: string,
  ): Promise<void> {
    await this.send(
      to,
      `Your ${getBrand().name} password was reset`,
      this.layout(`
        <p style="font-size: 15px; line-height: 1.5;">An admin reset your password for <strong>${orgName}</strong> on ${getBrand().name}. Here's your new password:</p>
        ${this.credentialsBlock(to, password, loginUrl)}
      `),
      `Password reset for ${to} in ${orgName}. New password: ${password} Login: ${loginUrl}`,
    );
  }
}
