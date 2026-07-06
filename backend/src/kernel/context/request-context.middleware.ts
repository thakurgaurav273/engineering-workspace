import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { RequestContextService } from './request-context.service';

/**
 * Seeds the ambient request context (T008) and a correlation id (T004) for every
 * request, then runs the rest of the request pipeline inside that ALS scope. Honors an
 * inbound `x-correlation-id` (so a trace can span services) and echoes it back on the
 * response for client-side correlation.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly context: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const inbound = req.headers['x-correlation-id'];
    const correlationId =
      (Array.isArray(inbound) ? inbound[0] : inbound) || randomUUID();

    res.setHeader('x-correlation-id', correlationId);
    this.context.run({ correlationId }, () => next());
  }
}
