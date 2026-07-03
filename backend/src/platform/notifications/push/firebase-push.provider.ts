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
      this.app = initializeApp(
        {
          credential: cert({
            projectId: FIREBASE_PROJECT_ID,
            clientEmail: FIREBASE_CLIENT_EMAIL,
            privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }),
        },
        'grovyn-notifications',
      );
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
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
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
