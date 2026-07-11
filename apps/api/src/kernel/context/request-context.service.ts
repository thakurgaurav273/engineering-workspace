import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

/**
 * Ambient, per-request context. Roadmap tasks T008 (ALS request-context) and T004
 * (observability: correlation-id propagation). This is intentionally read-mostly and
 * carries no behavior of its own yet - later phases (Tenant introduction, PDP) populate
 * `tenantId`/`orgId`/`principalId` and the ambient transaction wrapper (T009) will read
 * this to set the RLS GUC. Nothing consumes it for query scoping today, so introducing
 * it is a no-op for existing functionality.
 */
export interface RequestContext {
  correlationId: string;
  principalId?: string;
  tenantId?: string;
  orgId?: string;
  /** Per-request memoization store (e.g. the PDP's resolved permission sets). */
  cache?: Map<string, unknown>;
}

const storage = new AsyncLocalStorage<RequestContext>();

@Injectable()
export class RequestContextService {
  /** Run `fn` with `ctx` as the ambient context for the current async execution. */
  run<T>(ctx: RequestContext, fn: () => T): T {
    return storage.run(ctx, fn);
  }

  /** The current context, or `undefined` outside a request (e.g. cron, bootstrap). */
  get(): RequestContext | undefined {
    return storage.getStore();
  }

  get correlationId(): string | undefined {
    return storage.getStore()?.correlationId;
  }

  get orgId(): string | undefined {
    return storage.getStore()?.orgId;
  }

  get tenantId(): string | undefined {
    return storage.getStore()?.tenantId;
  }

  get principalId(): string | undefined {
    return storage.getStore()?.principalId;
  }

  /** Lazily-created per-request memo store, or undefined outside a request. */
  get cache(): Map<string, unknown> | undefined {
    const store = storage.getStore();
    if (!store) return undefined;
    if (!store.cache) store.cache = new Map();
    return store.cache;
  }

  /**
   * Merge fields into the current context. Used by later phases (e.g. an auth
   * interceptor stamping the resolved principal/org). No-op outside a request.
   */
  set(patch: Partial<RequestContext>): void {
    const store = storage.getStore();
    if (store) Object.assign(store, patch);
  }
}
