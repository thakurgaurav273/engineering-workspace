import { Module } from '@nestjs/common';
import { DataManagementController } from './data-management.controller';
import { DataManagementService } from './data-management.service';

@Module({
  controllers: [DataManagementController],
  providers: [DataManagementService],
})
export class DataManagementModule {}
