import { DocumentNumberingService, DOCUMENT_TYPES } from './document-numbering.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Concurrency test strategy
 * -------------------------
 * The real guarantee is `SELECT ... FOR UPDATE` inside a transaction: Postgres takes a
 * row lock on the (org, documentType) row, so concurrent reservations serialize - the
 * next caller blocks until the previous transaction commits. We cannot run Postgres here,
 * so this fake models exactly that: `$transaction` runs callbacks under a mutex (one at a
 * time), reproducing the row lock. If the service logic is correct under that lock, it is
 * correct in production. The test then fires many parallel next() calls and asserts the
 * issued numbers are unique (no duplicates) and contiguous (no skipped numbers).
 */
function fakePrisma() {
  const store = new Map<string, any>();
  let lock: Promise<unknown> = Promise.resolve();
  const key = (w: { orgId: string; documentType: string }) => `${w.orgId}|${w.documentType}`;

  const client: any = {
    documentNumberSequence: {
      upsert: async ({ where, create }: any) => {
        const k = key(where.orgId_documentType);
        if (!store.has(k)) store.set(k, { ...create });
        return store.get(k);
      },
      findUnique: async ({ where }: any) => store.get(key(where.orgId_documentType)) ?? null,
      findMany: async ({ where }: any) => [...store.values()].filter((r) => r.orgId === where.orgId),
      update: async ({ where, data }: any) => {
        const k = key(where.orgId_documentType);
        Object.assign(store.get(k), data);
        return store.get(k);
      },
    },
    // Tagged-template call: (strings, orgId, type). Returns the locked row.
    $queryRaw: async (_strings: TemplateStringsArray, orgId: string, type: string) => {
      const row = store.get(`${orgId}|${type}`);
      return row ? [row] : [];
    },
    // Serialize transactions to model FOR UPDATE row locking.
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => {
      const run = lock.then(() => fn(client));
      lock = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
  return client;
}

function service(prisma = fakePrisma()) {
  return { svc: new DocumentNumberingService(prisma as unknown as PrismaService), prisma };
}

describe('DocumentNumberingService', () => {
  it('lists all document types (config or defaults)', async () => {
    const { svc } = service();
    const list = await svc.list('org1');
    expect(list).toHaveLength(DOCUMENT_TYPES.length);
    expect(list[0]).toHaveProperty('preview');
  });

  it('preview does not reserve a number', async () => {
    const { svc } = service();
    await svc.preview('org1', 'INVOICE');
    expect((await svc.list('org1')).find((c) => c.documentType === 'INVOICE')?.currentNumber).toBe(0);
  });

  it('next() reserves sequential numbers', async () => {
    const { svc } = service();
    const a = await svc.next('org1', 'INVOICE');
    const b = await svc.next('org1', 'INVOICE');
    expect(a.sequence).toBe(1);
    expect(b.sequence).toBe(2);
    expect(a.number).not.toBe(b.number);
  });

  it('keeps numbering independent per document type', async () => {
    const { svc } = service();
    await svc.next('org1', 'INVOICE');
    const q = await svc.next('org1', 'QUOTATION');
    expect(q.sequence).toBe(1);
  });

  it('CONCURRENCY: 100 parallel reservations produce no duplicates and no skips', async () => {
    const { svc } = service();
    const results = await Promise.all(Array.from({ length: 100 }, () => svc.next('org1', 'INVOICE')));
    const sequences = results.map((r) => r.sequence).sort((a, b) => a - b);
    expect(new Set(sequences).size).toBe(100); // no duplicates
    expect(sequences).toEqual(Array.from({ length: 100 }, (_, i) => i + 1)); // no skips, 1..100
  });
});
