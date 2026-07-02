import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';

@Module({
  imports: [AuthModule, UsersModule, OrganizationsModule],
  exports: [UsersModule],
})
export class PlatformModule {}
