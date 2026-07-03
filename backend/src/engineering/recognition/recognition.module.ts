import { Module } from '@nestjs/common';
import { RecognitionController } from './recognition.controller';
import { RecognitionService } from './recognition.service';
import { NotificationsModule } from '@/platform/notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [RecognitionController],
  providers: [RecognitionService],
})
export class RecognitionModule {}
