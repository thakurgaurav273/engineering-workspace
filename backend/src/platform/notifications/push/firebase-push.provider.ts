import { Injectable, Logger } from '@nestjs/common';
import { App, cert, initializeApp } from 'firebase-admin/app';
import { BatchResponse, getMessaging } from 'firebase-admin/messaging';
import { PushProvider, PushPayload, PushSendResult } from './push-provider.interface';

const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

@Injectable()
export class FirebasePushProvider implements PushProvider {
  private readonly logger = new Logger(FirebasePushProvider.name);
  private app: App | null = null;

  constructor() {
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

    if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
      const trimmedKey = FIREBASE_PRIVATE_KEY.trim();
      // Base64-encoded form avoids "\n"-in-.env-value handling that differs across
      // deployment tooling; PEM-with-escaped-newlines is still supported for local dev.
      const privateKey = trimmedKey.startsWith('-----BEGIN')
        ? trimmedKey.replace(/\\n/g, '\n')
        : Buffer.from(trimmedKey, 'base64').toString('utf8');

      try {
        this.app = initializeApp(
          {
            credential: cert({
              projectId: FIREBASE_PROJECT_ID,
              clientEmail: FIREBASE_CLIENT_EMAIL,
              privateKey,
            }),
          },
          'grovyn-notifications',
        );
      } catch (err) {
        // A malformed credential must not take down the whole API — fall back to
        // logging pushes instead of crashing the process on every boot.
        this.logger.error(
          `Firebase init failed, push notifications will be logged, not sent: ${err instanceof Error ? err.message : err}`,
        );
      }
    } else {
      this.logger.warn('Firebase credentials not set — push notifications will be logged, not sent');
    }
  }

  async sendToTokens(tokens: string[], payload: PushPayload): Promise<PushSendResult> {
    if (!this.app || tokens.length === 0) {
      this.logger.log(`[push fallback] would send "${payload.title}" to ${tokens.length} token(s)`);
      return { invalidTokens: [] };
    }

    let response: BatchResponse;
    try {
      response = await getMessaging(this.app).sendEachForMulticast({
        tokens,
        // Data-only (no top-level `notification` field): when both are present, some
        // browsers (mobile Chrome especially) auto-display the notification from the
        // `notification` field AND the service worker's onBackgroundMessage fires and
        // shows it again, producing duplicate banners. Data-only keeps display fully
        // in our control (see public/firebase-messaging-sw.js and useForegroundPush).
        data: { ...payload.data, title: payload.title, body: payload.body },
      });
    } catch (err) {
      this.logger.error(`Push send failed: ${err instanceof Error ? err.message : err}`);
      return { invalidTokens: [] };
    }

    const invalidTokens = response.responses
      .map((r, i) => (!r.success && r.error && DEAD_TOKEN_CODES.has(r.error.code) ? tokens[i] : null))
      .filter((t): t is string => t !== null);

    return { invalidTokens };
  }
}
