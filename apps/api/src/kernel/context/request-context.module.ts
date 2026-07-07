import {
  Global,
  Module,
  NestModule,
  MiddlewareConsumer,
} from '@nestjs/common';
import { RequestContextService } from './request-context.service';
import { RequestContextMiddleware } from './request-context.middleware';

/**
 * Global module exposing the ambient request context and applying the correlation-id
 * middleware to every route. Global so any provider can inject
 * {@link RequestContextService} without re-importing (mirrors the existing PrismaModule
 * convention).
 */
@Global()
@Module({
  providers: [RequestContextService],
  exports: [RequestContextService],
})
export class RequestContextModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
