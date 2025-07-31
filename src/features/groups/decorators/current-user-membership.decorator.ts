import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { GroupMember } from 'generated/prisma';

export const CurrentUserMembershipParam = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request & { currentUserMembership: GroupMember } = ctx
      .switchToHttp()
      .getRequest();
    return request.currentUserMembership;
  },
);
