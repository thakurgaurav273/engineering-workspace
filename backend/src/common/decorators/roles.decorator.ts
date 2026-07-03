import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '@/common/guards/roles.guard';

export const Roles = (...roles: Array<'OWNER' | 'ADMIN' | 'MEMBER'>) =>
  SetMetadata(ROLES_KEY, roles);
