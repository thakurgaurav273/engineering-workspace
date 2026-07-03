import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { InvitationsModule } from './invitations/invitations.module';
import { LinearIntegrationModule } from './integrations/linear/linear-integration.module';

@Module({
  imports: [AuthModule, UsersModule, OrganizationsModule, InvitationsModule, LinearIntegrationModule],
  exports: [UsersModule, LinearIntegrationModule],
})
export class PlatformModule {}
