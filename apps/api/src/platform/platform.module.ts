import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { InvitationsModule } from './invitations/invitations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DataManagementModule } from './data-management/data-management.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    OrganizationsModule,
    InvitationsModule,
    NotificationsModule,
    DataManagementModule,
  ],
  exports: [UsersModule, NotificationsModule],
})
export class PlatformModule {}
