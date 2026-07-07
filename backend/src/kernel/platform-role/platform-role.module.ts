import { Global, Module } from '@nestjs/common';
import { PlatformRoleService } from './platform-role.service';

/** Global module exposing platform-role resolution (SUPER_ADMIN). Env-driven, additive. */
@Global()
@Module({
  providers: [PlatformRoleService],
  exports: [PlatformRoleService],
})
export class PlatformRoleModule {}
