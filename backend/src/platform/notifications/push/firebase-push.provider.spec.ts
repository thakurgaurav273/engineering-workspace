const sendEachForMulticast = jest.fn();

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({})),
  cert: jest.fn((c) => c),
}));
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn(() => ({ sendEachForMulticast })),
}));

import { FirebasePushProvider } from './firebase-push.provider';

describe('FirebasePushProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('without credentials configured', () => {
    beforeEach(() => {
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.FIREBASE_CLIENT_EMAIL;
      delete process.env.FIREBASE_PRIVATE_KEY;
    });

    it('falls back gracefully (no throw, no invalid tokens)', async () => {
      const provider = new FirebasePushProvider();
      const result = await provider.sendToTokens(['tok-1', 'tok-2'], { title: 'Hi', body: 'There' });
      expect(result).toEqual({ invalidTokens: [] });
      expect(sendEachForMulticast).not.toHaveBeenCalled();
    });

    it('returns no invalid tokens when there are no tokens to send to', async () => {
      const provider = new FirebasePushProvider();
      const result = await provider.sendToTokens([], { title: 'Hi', body: 'There' });
      expect(result).toEqual({ invalidTokens: [] });
    });
  });

  describe('with credentials configured', () => {
    beforeEach(() => {
      process.env.FIREBASE_PROJECT_ID = 'proj';
      process.env.FIREBASE_CLIENT_EMAIL = 'svc@proj.iam.gserviceaccount.com';
      process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nfake\\n-----END PRIVATE KEY-----';
    });

    it('deactivates tokens FCM reports as dead, keeps successful ones', async () => {
      sendEachForMulticast.mockResolvedValue({
        responses: [
          { success: true },
          { success: false, error: { code: 'messaging/registration-token-not-registered' } },
        ],
      });

      const provider = new FirebasePushProvider();
      const result = await provider.sendToTokens(['tok-good', 'tok-dead'], { title: 'Hi', body: 'There' });

      expect(result.invalidTokens).toEqual(['tok-dead']);
    });

    it('does not treat a transient error as an invalid token', async () => {
      sendEachForMulticast.mockResolvedValue({
        responses: [{ success: false, error: { code: 'messaging/internal-error' } }],
      });

      const provider = new FirebasePushProvider();
      const result = await provider.sendToTokens(['tok-1'], { title: 'Hi', body: 'There' });

      expect(result.invalidTokens).toEqual([]);
    });

    it('never throws when the send call itself rejects', async () => {
      sendEachForMulticast.mockRejectedValue(new Error('network down'));

      const provider = new FirebasePushProvider();
      await expect(provider.sendToTokens(['tok-1'], { title: 'Hi', body: 'There' })).resolves.toEqual({
        invalidTokens: [],
      });
    });
  });
});
