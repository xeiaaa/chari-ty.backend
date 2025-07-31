import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { Group, Upload } from 'generated/prisma';

export const GroupParam = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request & { group: Group & { avatar: Upload } } = ctx
      .switchToHttp()
      .getRequest();
    return request.group;
  },
);
