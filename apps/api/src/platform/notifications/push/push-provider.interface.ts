export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushSendResult {
  invalidTokens: string[];
}

export interface PushProvider {
  sendToTokens(tokens: string[], payload: PushPayload): Promise<PushSendResult>;
}

export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');
