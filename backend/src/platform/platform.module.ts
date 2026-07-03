import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { InvitationsModule } from './invitations/invitations.module';
import { LinearIntegrationModule } from './integrations/linear/linear-integration.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    OrganizationsModule,
    InvitationsModule,
    LinearIntegrationModule,
    NotificationsModule,
  ],
  exports: [UsersModule, LinearIntegrationModule, NotificationsModule],
})
export class PlatformModule {}
