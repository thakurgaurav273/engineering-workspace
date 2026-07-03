import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { PushService } from './push/push.service';
import { PUSH_PROVIDER } from './push/push-provider.interface';
import { FirebasePushProvider } from './push/firebase-push.provider';

@Module({
  imports: [JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PushService,
    NotificationsGateway,
    { provide: PUSH_PROVIDER, useClass: FirebasePushProvider },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
