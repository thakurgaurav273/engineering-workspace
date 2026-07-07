import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from './current-user.decorator';

export const OrgId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    return user.orgId;
  },
);
